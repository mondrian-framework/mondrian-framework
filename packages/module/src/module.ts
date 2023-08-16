import { func } from '.'
import { Function, Functions } from './function'
import { Logger } from './log'
import { projection, types } from '@mondrian-framework/model'

/**
 * The Mondrian module type.
 */
export type Module<Fs extends Functions, ContextInput = unknown> = {
  name: string
  version: string
  functions: {
    definitions: Fs
    options?: { [K in keyof Fs]?: { authentication?: AuthenticationMethod | 'NONE' } }
  }
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
      if (t.kind === 'array' || t.kind === 'nullable' || t.kind === 'optional' || t.kind === 'reference') {
        gatherTypes([t.wrappedType], explored)
      } else if (t.kind === 'object') {
        gatherTypes(Object.values(t.fields), explored)
      } else if (t.kind === 'union') {
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
 * Implementation of {@link ModuleBuilder}.
 */
class ModuleBuilderImpl<const Fs extends Functions, const ContextInput> {
  private module: Partial<Module<Fs, ContextInput>>
  constructor(module: Partial<Module<Fs, ContextInput>>) {
    this.module = module
  }
  public build(): Module<Fs, ContextInput> {
    const moduleName = this.module.name ?? 'default'
    const moduleVersion = this.module.version ?? '0.0.0'
    const moduleFunctions = this.module.functions
    const moduleContext = this.module.context
    if (!module || !moduleFunctions || !moduleContext) {
      throw new Error(`You need to use '.functions' and '.context' before building a module`)
    }
    assertUniqueNames(moduleFunctions.definitions)
    const outputTypeCheck = this.module.options?.checks?.output ?? 'throw'
    const maxProjectionDepth = this.module.options?.checks?.maxProjectionDepth
    const wrapperBuilder = func
      .before(({ args }) => {
        if (maxProjectionDepth != null) {
          const depth = projection.depth(args.projection ?? true)
          if (depth > maxProjectionDepth) {
            throw new Error(
              `Max projection depth reached: requested projection have a depth of ${depth}. The maximum is ${maxProjectionDepth}.`,
            )
          }
        }
        return args
      })
      .after(({ args, result, thisFunction }) => {
        //TODO: should also validator.validate
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
      })
    const wrappedFunctions = Object.fromEntries(
      Object.entries(moduleFunctions.definitions).map(([functionName, functionBody]) => {
        const wrappedFunction = wrapperBuilder
          .input(functionBody.input)
          .output(functionBody.output)
          .options(functionBody.options)
          .body(functionBody.apply)
          .build()
        return [functionName, wrappedFunction]
      }),
    )
    return {
      ...this.module,
      functions: { definitions: wrappedFunctions as Fs, options: moduleFunctions.options },
      name: moduleName,
      version: moduleVersion,
      context: moduleContext,
    }
  }
  public name(name: string): ModuleBuilderImpl<Fs, ContextInput> {
    return new ModuleBuilderImpl({ ...this.module, name })
  }
  public version(version: string): ModuleBuilderImpl<Fs, ContextInput> {
    return new ModuleBuilderImpl({ ...this.module, version })
  }
  public options(options: ModuleOptions): ModuleBuilderImpl<Fs, ContextInput> {
    return new ModuleBuilderImpl({ ...this.module, options })
  }
  public context<const NewContextInput>(
    context: Module<Fs, NewContextInput>['context'],
  ): ModuleBuilderImpl<Fs, NewContextInput> {
    const definitions = this.module.functions?.definitions
    if (!definitions) {
      throw new Error(`You need to use '.functions' before`)
    }
    return new ModuleBuilderImpl({ ...this.module, context })
  }
  public functions<const NewFs extends Functions>(
    functions: Module<NewFs, ContextInput>['functions']['definitions'],
  ): ModuleBuilderImpl<NewFs, ContextInput> {
    return new ModuleBuilderImpl({
      ...this.module,
      functions: { definitions: functions },
      context: undefined,
    })
  }
  public functionsOptions(
    options: Exclude<Module<Fs, ContextInput>['functions']['options'], undefined>,
  ): ModuleBuilderImpl<Fs, ContextInput> {
    const definitions = this.module.functions?.definitions
    if (!definitions) {
      throw new Error(`You need to use '.functions' before`)
    }
    return new ModuleBuilderImpl({ ...this.module, functions: { definitions, options } })
  }
}

/**
 * Module builder type.
 */
type ModuleBuilder<Fs extends Functions, ContextInput, Excluded extends string> = Omit<
  {
    build(): Module<Fs, ContextInput>
    name(name: string): ModuleBuilder<Fs, ContextInput, Excluded | 'name'>
    version(version: string): ModuleBuilder<Fs, ContextInput, Excluded | 'version'>
    options(options: ModuleOptions): ModuleBuilder<Fs, ContextInput, Excluded | 'options'>
    context<const NewContextInput>(
      context: Module<Fs, NewContextInput>['context'],
    ): ModuleBuilder<Fs, NewContextInput, Exclude<Excluded | 'context', 'build'>>
    functions<const NewFs extends Functions>(
      functions: Module<NewFs, ContextInput>['functions']['definitions'],
    ): ModuleBuilder<NewFs, ContextInput, Exclude<Excluded | 'functions', 'functionsOptions' | 'context'>>
    functionsOptions(
      options: Exclude<Module<Fs, ContextInput>['functions']['options'], undefined>,
    ): ModuleBuilder<Fs, ContextInput, Excluded | 'functionsOptions'>
  },
  Excluded
>

/**
 * The module builder singleton. It's used to build any Mondrian module.
 *
 * Example:
 * ```typescript
 * import { types } from '@mondrian-framework/model'
 * import { module } from '@mondrian-framework/module'
 *
 * const myModule = module
 *   .name("MyModule")
 *   .version("0.0.1")
 *   .options({ checks: { maxProjectionDepth: 5 } })
 *   .functions({ login: loginFunction })
 *   .context(() => async ({}))
 *   .build()
 * ```
 */
export const builder: ModuleBuilder<{}, unknown, 'functionsOptions' | 'context' | 'build'> = new ModuleBuilderImpl({})
