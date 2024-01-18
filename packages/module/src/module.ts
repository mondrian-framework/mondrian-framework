import { functions, provider, security } from '.'
import { ErrorType, OutputRetrieveCapabilities, Providers, Tracer } from './function'
import { BaseFunction } from './function/base'
import { OpentelemetryFunction } from './function/opentelemetry'
import * as middleware from './middleware'
import { allUniqueTypes } from './utils'
import { model } from '@mondrian-framework/model'
import { UnionToIntersection } from '@mondrian-framework/utils'
import opentelemetry, { ValueType } from '@opentelemetry/api'

/**
 * The Mondrian module interface.
 * Contains only the function signatures, module name and version.
 */
export interface ModuleInterface<Fs extends functions.FunctionsInterfaces = functions.FunctionsInterfaces> {
  name: string
  description?: string
  functions: Fs
}

/**
 * The Mondrian module type.
 * Contains all the module functions with also the implementation and how to build the context.
 */
export interface Module<Fs extends functions.Functions = functions.Functions> extends ModuleInterface {
  name: string
  functions: Fs
  policies?: (context: Partial<FunctionsToContextSum<Fs>>) => security.Policies
  options?: ModuleOptions
}

export type FunctionsToContextInput<Fs extends functions.Functions = functions.Functions> = UnionToIntersection<
  {
    [K in keyof Fs]: functions.ProvidersToContextInput<Fs[K]['providers']>
  }[keyof Fs]
>

/**
 * Intersection of all function's Contexts.
 */
export type FunctionsToContextSum<Fs extends functions.Functions> = UnionToIntersection<
  { [K in keyof Fs]: functions.ProvidersToContext<Fs[K]['providers']> }[keyof Fs]
>

/**
 * Mondrian module options.
 */
export type ModuleOptions = {
  /**
   * Checks (at runtime) if the output value of any function is valid.
   * It also checks if the eventual selection is respected.
   * Default is 'throw'.
   * With 'ignore' the check is skipped (could be usefull in production environment in order to improve performance)
   */
  checkOutputType?: 'ignore' | 'log' | 'throw'
  /**
   * Maximum selection depth allowed. If the requested selection is deeper an error is thrown.
   * The default is any depth.
   * In production it is suggested to set a limit (like 3) in order to prevent denial of service attack.
   */
  maxSelectionDepth?: number
  /**
   * Enables opetelemetry instrumentation.
   */
  opentelemetry?: boolean
}

/**
 * Checks for name collisions in the types that appear in the given function's signature.
 * If there's at least two different types sharing the same name, this function will throw
 * an error.
 */
function assertUniqueNames(functions: functions.FunctionsInterfaces) {
  const functionTypes = Object.values(functions).flatMap((f) => {
    const hasError = f.errors !== undefined
    return hasError ? [f.input, f.output, ...Object.values(f.errors)] : [f.input, f.output]
  })

  const allTypes = allUniqueTypes(functionTypes)
  const allNames = [...allTypes.values()].flatMap((t) => {
    const name = model.concretise(t).options?.name
    return name != null ? [name] : []
  })
  allNames.forEach((name, index) => {
    if (allNames.indexOf(name) !== index) {
      throw new Error(`Duplicated type name "${name}"`)
    }
  })
}

/**
 * Checks if the errors used by the providers are defined in the function errors.
 */
function assertCorrectProviderErrors(functions: functions.Functions) {
  for (const [functionName, functionBody] of Object.entries(functions)) {
    for (const [providerName, provider] of Object.entries(functionBody.providers as functions.Providers)) {
      const providerErrors = Object.entries(provider.errors ?? {})
      const functionErrors = (functionBody.errors ?? {}) as model.Types
      for (const [errorName, errorType] of providerErrors) {
        if (!(errorName in functionErrors)) {
          throw new Error(
            `Provider "${providerName}" use error "${errorName}" that is not defined in function "${functionName}" errors`,
          )
        }
        const functionErrorType = functionErrors[errorName]
        if (!model.areEqual(errorType, functionErrorType)) {
          throw new Error(
            `Provider "${providerName}" use error "${errorName}" that is not equal to the function "${functionName}" error type`,
          )
        }
      }
    }
  }
}

function assertCorrectProviderNames(functions: functions.Functions) {
  const reservedNames = ['input', 'retrieve', 'logger', 'tracer']
  for (const [functionName, functionBody] of Object.entries(functions)) {
    for (const providerName of Object.keys(functionBody.providers)) {
      if (reservedNames.includes(providerName)) {
        throw new Error(`Provider "${providerName}" is using a reserved name in function "${functionName}". `)
      }
    }
  }
}

/**
 * Builds any Mondrian module.
 *
 * Example:
 * ```typescript
 * import { module } from '@mondrian-framework/module'
 *
 * const myModule = module
 *   .build({
 *     name: "MyModule",
 *     version: "0.0.1",
 *     options: { checks: { maxProjectionDepth: 5 } },
 *     functions: { login: loginFunction },
 *     context: async () => ({})
 *   })
 * ```
 */
export function build<const Fs extends functions.Functions>(module: Module<Fs>): Module<Fs> {
  assertUniqueNames(module.functions)
  assertCorrectProviderErrors(module.functions)
  assertCorrectProviderNames(module.functions)

  const maxProjectionDepthMiddleware =
    module.options?.maxSelectionDepth != null
      ? [middleware.checkMaxSelectionDepth(module.options.maxSelectionDepth)]
      : []
  const checkPoliciesMiddleware = module.policies != null ? [middleware.checkPolicies(module.policies)] : []

  const wrappedFunctions = Object.fromEntries(
    Object.entries(module.functions).map(([functionName, functionBody]) => {
      const checkOutputTypeMiddleware =
        module.options?.checkOutputType == null || module.options?.checkOutputType !== 'ignore'
          ? [middleware.checkOutputType(functionName, module.options?.checkOutputType ?? 'throw')]
          : []

      const func: functions.FunctionImplementation = {
        ...functionBody,
        middlewares: [
          ...maxProjectionDepthMiddleware,
          ...(functionBody.middlewares ?? []),
          ...checkPoliciesMiddleware,
          ...checkOutputTypeMiddleware,
        ],
      }
      if (module.options?.opentelemetry) {
        const tracer = opentelemetry.trace.getTracer(`${module.name}:${functionName}-tracer`)
        const myMeter = opentelemetry.metrics.getMeter(`${module.name}:${functionName}-meter`)
        const histogram = myMeter.createHistogram('task.duration', { unit: 'milliseconds', valueType: ValueType.INT })
        const counter = myMeter.createCounter('task.invocation')
        const wrappedFunction: functions.FunctionImplementation<
          model.Type,
          model.Type,
          ErrorType,
          OutputRetrieveCapabilities,
          Providers
        > = new OpentelemetryFunction(func, functionName, { histogram, tracer, counter })
        return [functionName, wrappedFunction]
      } else {
        return [functionName, new BaseFunction(func)]
      }
    }),
  ) as Fs
  return { ...module, functions: wrappedFunctions }
}

/**
 * Defines only the signature of the {@link Module} i.e. the {@link ModuleInterface}.
 * @param module a map of {@link FunctionInterface}, module name and module version.
 * @returns the module interface
 */
export function define<const Fs extends functions.FunctionsInterfaces>(
  module: ModuleInterface<Fs>,
): ModuleInterface<Fs> & {
  implement: <
    FsI extends {
      [K in keyof Fs]: functions.FunctionImplementation<Fs[K]['input'], Fs[K]['output'], Fs[K]['errors'], any, any>
    },
  >(
    module: Pick<Module<FsI>, 'functions' | 'policies' | 'options'>,
  ) => Module<FsI>
} {
  assertUniqueNames(module.functions)
  return { ...module, implement: (moduleImpl) => build({ ...module, ...moduleImpl }) }
}
