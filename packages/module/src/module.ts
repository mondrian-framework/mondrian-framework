import { functions, logger } from '.'
import { BaseFunction } from './function/base'
import { OpentelemetryFunction } from './function/opentelemetry'
import * as middleware from './middleware'
import { projection, types } from '@mondrian-framework/model'
import opentelemetry, { ValueType } from '@opentelemetry/api'

export type ErrorType = types.UnionType<Record<string, types.Type>> | types.NeverType

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
    [K in keyof F]: F[K] extends functions.FunctionImplementation<any, any, infer Context> ? Context : never
  }[keyof F]
>

/**
 * TODO: understand if this is needed
 */
type AuthenticationMethod = { type: 'bearer'; format: 'jwt' }

/**
 * Checks for name collisions.
 */
function assertUniqueNames(functions: functions.Functions) {
  function gatherTypes(ts: types.Type[], explored?: Set<types.Type>): types.Type[] {
    explored = explored ?? new Set<types.Type>()
    for (const type of ts) {
      if (explored.has(type)) {
        continue
      }
      explored.add(type)
      const t = types.concretise(type)
      if (t.kind === types.Kind.Array || t.kind === types.Kind.Nullable || t.kind === types.Kind.Optional) {
        gatherTypes([t.wrappedType], explored)
      } else if (t.kind === types.Kind.Object) {
        gatherTypes(
          Object.values(t.fields as types.Fields).map((v) => types.unwrapField(v)),
          explored,
        )
      } else if (t.kind === types.Kind.Union) {
        gatherTypes(Object.values(t.variants), explored)
      }
    }
    return [...explored.values()]
  }

  const allTypes = gatherTypes(Object.values(functions).flatMap((f) => [f.input, f.output]))
  const allNames = allTypes
    .map((t) => types.concretise(t).options?.name)
    .flatMap((name) => (name != null ? [name] : []))
  for (let i = 0; i < allNames.length; i++) {
    if (allNames.indexOf(allNames[i]) !== i) {
      throw new Error(`Duplicated type name "${allNames[i]}"`)
    }
  }
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
