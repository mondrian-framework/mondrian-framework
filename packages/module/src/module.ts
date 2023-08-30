import { functions, logger } from '.'
import { FunctionImplementation } from './function/implementation'
import { OpentelemetryFunction } from './function/opentelemetry'
import * as middleware from './middleware'
import { projection, types } from '@mondrian-framework/model'
import opentelemetry, { ValueType } from '@opentelemetry/api'

/**
 * The Mondrian module type.
 */
export type Module<Fs extends functions.Functions = functions.Functions, ContextInput = unknown> = {
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
    [K in keyof F]: F[K] extends functions.Function<any, any, infer Context> ? Context : never
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
      if (
        t.kind === types.Kind.Array ||
        t.kind === types.Kind.Nullable ||
        t.kind === types.Kind.Optional ||
        t.kind === types.Kind.Reference
      ) {
        gatherTypes([t.wrappedType], explored)
      } else if (t.kind === types.Kind.Object) {
        gatherTypes(Object.values(t.fields), explored)
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
  const maxProjectionDepthMiddleware = module.options?.checks?.maxProjectionDepth
    ? [middleware.checkMaxProjectionDepth(module.options.checks.maxProjectionDepth)]
    : []
  const checkOutputTypeMiddleware =
    module.options?.checks?.output == null || module.options?.checks?.output !== 'ignore'
      ? [middleware.checkOutputType(module.options?.checks?.output ?? 'throw')]
      : []

  const wrappedFunctions = Object.fromEntries(
    Object.entries(module.functions).map(([functionName, functionBody]) => {
      const tracer = opentelemetry.trace.getTracer(`${module.name}:${functionName}-tracer`)
      const myMeter = opentelemetry.metrics.getMeter(`${module.name}:${functionName}-meter`)
      const histogram = myMeter.createHistogram('task.duration', { unit: 'milliseconds', valueType: ValueType.INT })
      const counter = myMeter.createCounter('task.invocation')
      const func: functions.Function = {
        ...functionBody,
        middlewares: [
          ...maxProjectionDepthMiddleware,
          ...checkOutputTypeMiddleware,
          ...(functionBody.middlewares ?? []),
        ],
      }
      const wrappedFunction: functions.Function<types.Type, types.Type, {}> = module.options
        ?.opentelemetryInstrumentation
        ? new OpentelemetryFunction(func, functionName, { histogram, tracer, counter })
        : new FunctionImplementation(func)
      return [functionName, wrappedFunction]
    }),
  ) as Fs
  return { ...module, functions: wrappedFunctions }
}
