import { functions, guard, provider, security } from '.'
import { BaseFunction } from './function/base'
import { OpentelemetryFunction } from './function/opentelemetry'
import * as middleware from './middleware'
import { allUniqueTypes, reservedProvidersNames } from './utils'
import { model } from '@mondrian-framework/model'
import { UnionToIntersection } from '@mondrian-framework/utils'
import opentelemetry, { ValueType } from '@opentelemetry/api'

/**
 * The Mondrian module interface.
 * Contains only the function signatures, module name and version.
 */
export interface ModuleInterface<Fs extends functions.FunctionInterfaces = functions.FunctionInterfaces> {
  name: string
  description?: string
  functions: Fs
}

/**
 * The Mondrian module type.
 * Contains all the module functions with also the implementation and how to build the context.
 */
export interface Module<Fs extends functions.FunctionImplementations = functions.FunctionImplementations>
  extends ModuleInterface {
  name: string
  functions: Fs
  policies?: (args: ModuleMiddlewareInputArgs<Fs>) => security.Policies | Promise<security.Policies>
  options?: ModuleOptions
}

export interface ModuleBuildInput<Fs extends functions.Functions = functions.Functions> extends ModuleInterface {
  name: string
  functions: Fs
  policies?: (args: ModuleMiddlewareInputArgs<Fs>) => security.Policies | Promise<security.Policies>
  options?: ModuleOptions
}

/**
 * Convert a map of functions to the context input object by merging all the required inputs.
 */
export type FunctionsToContextInput<Fs extends functions.Functions = functions.Functions> = UnionToIntersection<
  {
    [K in keyof Fs]: functions.FunctionContextInput<Fs[K]['providers'], Fs[K]['guards']>
  }[keyof Fs]
>

/**
 * Convert a map of functions to the union of possible functions arguments.
 */
type ModuleMiddlewareInputArgs<Fs extends functions.Functions> = {
  [K in keyof Fs]: functions.FunctionArguments<
    Fs[K]['input'],
    Fs[K]['output'],
    Fs[K]['retrieve'],
    Fs[K]['providers']
  > & { functionName: K }
}[keyof Fs]

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
function assertUniqueNames(functions: functions.FunctionInterfaces) {
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

//TODO: move this checks inside the function definition
/**
 * Checks if the errors used by the providers are defined in the function errors.
 */
function assertCorrectErrors(functions: functions.Functions, what: 'providers' | 'guards') {
  for (const [functionName, functionBody] of Object.entries(functions)) {
    for (const [providerName, provider] of Object.entries(functionBody[what] as provider.Providers)) {
      const providerErrors = gatherProviderErrors(provider)
      const functionErrors = (functionBody.errors ?? {}) as model.Types
      for (const [errorName, errorType] of providerErrors) {
        if (!(errorName in functionErrors)) {
          throw new Error(
            `${what === 'providers' ? 'Provider' : 'Guard'} "${providerName}" use error "${errorName}" that is not defined in function "${functionName}" errors`,
          )
        }
        const functionErrorType = functionErrors[errorName]
        if (!model.areEqual(errorType, functionErrorType)) {
          throw new Error(
            `${what === 'providers' ? 'Provider' : 'Guard'} "${providerName}" use error "${errorName}" that is not equal to the function "${functionName}" error type`,
          )
        }
      }
    }
  }
}

function gatherProviderErrors(provider: provider.ContextProvider): [string, model.Type][] {
  const result = Object.entries(provider.errors ?? {})
  for (const subProvider of Object.values(provider.providers)) {
    result.push(...gatherProviderErrors(subProvider))
  }
  return result
}

function assertCorrectProviderNames(functions: functions.Functions) {
  for (const [functionName, functionBody] of Object.entries(functions)) {
    for (const providerName of Object.keys(functionBody.providers)) {
      if (reservedProvidersNames.includes(providerName)) {
        throw new Error(`Provider name "${providerName}" is reserved in function "${functionName}". `)
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
export function build<const Fs extends functions.Functions>(
  module: ModuleBuildInput<Fs>,
): Module<FunctionsToFunctionsImplementation<Fs>> {
  assertUniqueNames(module.functions)
  assertCorrectErrors(module.functions, 'providers')
  assertCorrectErrors(module.functions, 'guards')
  assertCorrectProviderNames(module.functions)

  const maxProjectionDepthMiddleware =
    module.options?.maxSelectionDepth != null
      ? [middleware.checkMaxSelectionDepth(module.options.maxSelectionDepth)]
      : []

  const checkPoliciesMiddleware = module.policies != null ? [middleware.checkPolicies(module.policies as any)] : []

  const checkOutputTypeMiddleware =
    module.options?.checkOutputType == null || module.options?.checkOutputType !== 'ignore'
      ? [middleware.checkOutputType(module.options?.checkOutputType ?? 'throw')]
      : []

  const wrappedFunctions = Object.fromEntries(
    Object.entries(module.functions).map(([functionName, functionBody]) => {
      const func = {
        ...functionBody,
        middlewares: [
          ...checkOutputTypeMiddleware,
          ...maxProjectionDepthMiddleware,
          ...(functionBody.middlewares ?? []),
          ...checkPoliciesMiddleware,
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
          functions.ErrorType,
          functions.OutputRetrieveCapabilities,
          provider.Providers,
          guard.Guards
        > = new OpentelemetryFunction(func, functionName, { histogram, tracer, counter })
        return [functionName, wrappedFunction]
      } else {
        return [functionName, new BaseFunction(func, functionName)]
      }
    }),
  ) as Fs
  return { ...module, functions: wrappedFunctions as any }
}

/**
 * Defines only the signature of the {@link Module} i.e. the {@link ModuleInterface}.
 * @param module a map of {@link FunctionInterface}, module name and module version.
 * @returns the module interface
 */
export function define<const Fs extends functions.FunctionInterfaces>(
  module: ModuleInterface<Fs>,
): ModuleInterface<Fs> & {
  implement: <
    FsI extends {
      [K in keyof Fs]: functions.Function<Fs[K]['input'], Fs[K]['output'], Fs[K]['errors'], any, any, any>
    },
  >(
    module: Pick<ModuleBuildInput<FsI>, 'functions' | 'policies' | 'options'>,
  ) => Module<FunctionsToFunctionsImplementation<FsI>>
} {
  assertUniqueNames(module.functions)
  return { ...module, implement: (moduleImpl) => build({ ...module, ...moduleImpl }) }
}

type FunctionsToFunctionsImplementation<Fs extends functions.Functions> = {
  [K in keyof Fs]: functions.FunctionImplementation<
    Fs[K]['input'],
    Fs[K]['output'],
    Fs[K]['errors'],
    Fs[K]['retrieve'],
    Fs[K]['providers'],
    Fs[K]['guards']
  >
}
