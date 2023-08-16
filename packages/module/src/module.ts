import { func } from '.'
import { AfterMiddleware, BeforeMiddleware, Function, Functions } from './function'
import { Logger } from './log'
import { projection, types } from '@mondrian-framework/model'

/**
 * The Mondrian module type.
 */
export type Module<Fs extends Functions, ContextInput = unknown> = {
  name: string
  version: string
  functions: Fs
  functinoOptions?: { [K in keyof Fs]?: { authentication?: AuthenticationMethod | 'NONE' } }
  authentication?: AuthenticationMethod
  context: (
    input: ContextInput,
    args: {
      input: unknown
      projection: projection.Projection | undefined
      operationId: string
      log: Logger
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
}

//TODO: factorize UnionToIntersection to utils package
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never

/**
 * Intersection of all function's Contexts.
 */
type ContextType<F extends Functions> = UnionToIntersection<
  {
    [K in keyof F]: F[K] extends Function<any, any, infer Context> ? Context : never
  }[keyof F]
>

/**
 * TODO
 */
type AuthenticationMethod = { type: 'bearer'; format: 'jwt' }

/**
 * Checks for name collisions.
 */
function assertUniqueNames(functions: Functions) {
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
 * Module builder.
 */
class ModuleBuilder {
  constructor() {}

  /**
   * Builds a mondrian module
   * @returns The builded mondrian Module.
   */
  public build<const Fs extends Functions, const ContextInput>(
    module: Module<Fs, ContextInput>,
  ): Module<Fs, ContextInput> {
    assertUniqueNames(module.functions)
    const outputTypeCheck = module.options?.checks?.output ?? 'throw'
    const maxProjectionDepth = module.options?.checks?.maxProjectionDepth
    const maxDepthMiddleware: BeforeMiddleware<types.Type, types.Type, {}> = {
      name: 'Check max projection depth',
      apply: ({ args }) => {
        if (maxProjectionDepth != null) {
          const depth = projection.depth(args.projection ?? true)
          if (depth > maxProjectionDepth) {
            throw new Error(
              `Max projection depth reached: requested projection have a depth of ${depth}. The maximum is ${maxProjectionDepth}.`,
            )
          }
        }
        return args
      },
    }
    const outputCheckMiddleware: AfterMiddleware<types.Type, types.Type, {}> = {
      name: 'Check output type',
      apply: ({ args, thisFunction, result }) => {
        const projectionRespectedResult = projection.respectsProjection(
          thisFunction.output,
          args.projection ?? true,
          result,
        )
        if (!projectionRespectedResult.isOk) {
          //TODO: prettify error?
          const m = JSON.stringify({ projection: args.projection, errors: projectionRespectedResult.error })
          if (outputTypeCheck === 'log') {
            args.log(`Invalid output: ${m}`, 'error')
          } else {
            throw new Error(`Invalid output: ${m}`)
          }
        }
        return result
      },
    }
    const wrappedFunctions = Object.fromEntries(
      Object.entries(module.functions).map(([functionName, functionBody]) => {
        const wrappedFunction = func.build({
          ...functionBody,
          before: [maxDepthMiddleware],
          after: [outputCheckMiddleware],
        })
        return [functionName, wrappedFunction]
      }),
    ) as Fs
    return { ...module, functions: wrappedFunctions }
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
export const builder: ModuleBuilder = new ModuleBuilder()
