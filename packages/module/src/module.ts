import { functions, logger } from '.'
import { ErrorType } from './function'
import { BaseFunction } from './function/base'
import { OpentelemetryFunction } from './function/opentelemetry'
import * as middleware from './middleware'
import { projection, types } from '@mondrian-framework/model'
import { assertNever, count } from '@mondrian-framework/utils'
import opentelemetry, { ValueType } from '@opentelemetry/api'

/**
 * The Mondrian module type.
 */
export interface Module<Fs extends functions.Functions = functions.Functions, ContextInput = unknown> {
  name: string
  version: string
  functions: Fs
  functionOptions?: { [K in keyof Fs]?: { authentication?: AuthenticationMethod | 'NONE' } }
  authentication?: AuthenticationMethod
  context: (
    input: ContextInput,
    args: {
      input: unknown
      projection: projection.Projection | undefined
      operationId: string
      logger: logger.MondrianLogger
    },
  ) => Promise<ContextType<Fs>>
  options?: ModuleOptions
}

/**
 * Mondrian module options.
 */
export type ModuleOptions = {
  checks?: {
    /**
     * Checks (at runtime) if the output value of any function is valid.
     * It also checks if the projection is respected.
     * Default is 'throw'.
     * With 'ignore' the check is skipped (could be usefull in production environment in order to improve performance)
     */
    output?: 'ignore' | 'log' | 'throw'
    /**
     * Maximum projection depth allowed. If the requested projection is deeper an error is thrown.
     */
    maxProjectionDepth?: number
  }
  /**
   * Enables opetelemetry instrumentation.
   */
  opentelemetryInstrumentation?: boolean
}

//TODO: factorize UnionToIntersection to utils package
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never

/**
 * Intersection of all function's Contexts.
 */
type ContextType<F extends functions.Functions> = UnionToIntersection<
  {
    [K in keyof F]: F[K] extends functions.FunctionImplementation<any, any, any, infer Context> ? Context : never
  }[keyof F]
>

/**
 * TODO: understand if this is needed
 */
type AuthenticationMethod = { type: 'bearer'; format: 'jwt' }

export function uniqueTypes(from: types.Type): Set<types.Type> {
  return gatherUniqueTypes(new Set(), from)
}

export function allUniqueTypes(from: types.Type[]): Set<types.Type> {
  return from.reduce(gatherUniqueTypes, new Set())
}

function gatherUniqueTypes(inspectedTypes: Set<types.Type>, type: types.Type): Set<types.Type> {
  if (inspectedTypes.has(type)) {
    return inspectedTypes
  } else {
    inspectedTypes.add(type)
  }

  if (typeof type === 'function') {
    const concreteType = type()
    switch (concreteType.kind) {
      case types.Kind.Union:
        return gatherTypesReferencedByUnion(inspectedTypes, concreteType)
      case types.Kind.Object:
        return gatherTypesReferencedByObject(inspectedTypes, concreteType)
      default:
        assertNever(concreteType)
    }
  } else {
    switch (type.kind) {
      case types.Kind.Number:
      case types.Kind.String:
      case types.Kind.Boolean:
      case types.Kind.Enum:
      case types.Kind.Literal:
      case types.Kind.Custom:
        return inspectedTypes
      case types.Kind.Array:
      case types.Kind.Optional:
      case types.Kind.Nullable:
        return gatherUniqueTypes(inspectedTypes, type.wrappedType)
      case types.Kind.Union:
        return gatherTypesReferencedByUnion(inspectedTypes, type)
      case types.Kind.Object:
        return gatherTypesReferencedByObject(inspectedTypes, type)
      default:
        assertNever(type)
    }
  }
}

function gatherTypesReferencedByUnion(inspectedTypes: Set<types.Type>, type: types.UnionType<any>): Set<types.Type> {
  const variants = type.variants as Record<string, types.Type>
  return Object.values(variants).reduce(gatherUniqueTypes, inspectedTypes)
}

function gatherTypesReferencedByObject(
  inspectedTypes: Set<types.Type>,
  type: types.ObjectType<any, any>,
): Set<types.Type> {
  const fields = type.fields as Record<string, types.Field>
  return Object.values(fields).reduce(gatherTypesReferencedByField, inspectedTypes)
}

function gatherTypesReferencedByField(inspectedTypes: Set<types.Type>, field: types.Field): Set<types.Type> {
  return gatherUniqueTypes(inspectedTypes, types.unwrapField(field))
}

/**
 * Checks for name collisions.
 */
function assertUniqueNames(functions: functions.Functions) {
  const allTypes = allUniqueTypes(Object.values(functions).flatMap((f) => [f.input, f.output, f.error]))
  const allNames = [...allTypes.values()]
    .map((t) => types.concretise(t).options?.name)
    .filter((name) => name !== undefined)

  count(allNames).forEach((value, key) => {
    if (value > 1) throw new Error(`Duplicated type name "${key}"`)
  })
}

/**
 * The module builder singleton. It's used to build any Mondrian module.
 *
 * Example:
 * ```typescript
 * import { types } from '@mondrian-framework/model'
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
export function build<const Fs extends functions.Functions, const ContextInput>(
  module: Module<Fs, ContextInput>,
): Module<Fs, ContextInput> {
  assertUniqueNames(module.functions)
  const maxProjectionDepthMiddleware =
    module.options?.checks?.maxProjectionDepth != null
      ? [middleware.checkMaxProjectionDepth(module.options.checks.maxProjectionDepth)]
      : []
  const checkOutputTypeMiddleware =
    module.options?.checks?.output == null || module.options?.checks?.output !== 'ignore'
      ? [middleware.checkOutputType(module.options?.checks?.output ?? 'throw')]
      : []

  const wrappedFunctions = Object.fromEntries(
    Object.entries(module.functions).map(([functionName, functionBody]) => {
      const func: functions.FunctionImplementation = {
        ...functionBody,
        middlewares: [
          ...maxProjectionDepthMiddleware,
          ...(functionBody.middlewares ?? []),
          ...checkOutputTypeMiddleware,
        ],
      }
      if (module.options?.opentelemetryInstrumentation) {
        const tracer = opentelemetry.trace.getTracer(`${module.name}:${functionName}-tracer`)
        const myMeter = opentelemetry.metrics.getMeter(`${module.name}:${functionName}-meter`)
        const histogram = myMeter.createHistogram('task.duration', { unit: 'milliseconds', valueType: ValueType.INT })
        const counter = myMeter.createCounter('task.invocation')
        const wrappedFunction: functions.FunctionImplementation<types.Type, types.Type, ErrorType, {}> =
          new OpentelemetryFunction(func, functionName, { histogram, tracer, counter })
        return [functionName, wrappedFunction]
      } else {
        return [functionName, new BaseFunction(func)]
      }
    }),
  ) as Fs
  return { ...module, functions: wrappedFunctions }
}

/*
export interface ModuleInterface<FsI extends Record<string, functions.FunctionInterface>> {
  name: string
  version: string
  functions: FsI
}

export function define<const Fs extends Record<string, functions.FunctionInterface>>(
  module: ModuleInterface<Fs>,
): ModuleInterface<Fs> {
  return module
}

export function ofDefinition<
  const FsI extends Record<string, functions.FunctionInterface>,
  const Fs extends { [K in keyof FsI]: functions.FunctionImplementation<FsI[K]['input'], FsI[K]['output'], any> },
  const ContextInput = unknown,
>(
  moduleInterface: ModuleInterface<FsI>,
  module: Omit<Module<Fs, ContextInput>, 'name' | 'version'>,
): Module<Fs, ContextInput> {
  return { ...moduleInterface, ...module }
}
*/
