import { Function, Functions } from './function'
import { Logger } from './log'
import { projection, types } from '@mondrian-framework/model'

//TODO: factorize UnionToIntersection to utils package
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never
type ContextType<F extends Functions> = UnionToIntersection<
  {
    [K in keyof F]: F[K] extends Function<any, any, infer Context> ? Context : never
  }[keyof F]
>

type AuthenticationMethod = { type: 'bearer'; format: 'jwt' }

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

export type ModuleOptions = {
  checks?: {
    output?: 'ignore' | 'log' | 'throw'
    maxProjectionDepth?: number
  }
}

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

  //check for double type names
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
    const functions = Object.fromEntries(
      Object.entries(moduleFunctions.definitions).map(([functionName, functionBody]) => {
        const f: Function<types.Type, types.Type, unknown> = {
          ...functionBody,
          async apply(args) {
            //PROJECTION DEPTH
            if (maxProjectionDepth != null) {
              //TODO: wait for implementation change
              /*const depth = projection.depth(args.projection)
              if (depth > maxProjectionDepth) {
                throw new Error(`Max projection depth reached: ${depth}`)
              }*/
            }

            const result = await functionBody.apply(args)

            //OUTPUT CHECK
            if (outputTypeCheck !== 'ignore') {
              //TODO: use projection.respectsProjection and the custom validate of partial deep
              /*const projectedType = projection.projectedType(functionBody.output, args.projection)
              const isCheck = decoder.decode(projectedType as types.Type, result, {
                typeCastingStrategy: 'expectExactTypes',
              })
              if (!isCheck.isOk) {
                const m = JSON.stringify({ projection: args.projection, errors: isCheck.error })
                if (outputTypeCheck === 'log') {
                  args.log(`Invalid output: ${m}`, 'error')
                } else {
                  throw new Error(`Invalid output: ${m}`)
                }
              }*/
            }
            return result
          },
        }
        return [functionName, f]
      }),
    )
    return {
      ...this.module,
      functions: { definitions: functions as Fs, options: moduleFunctions.options },
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

type ModuleBuilder<Fs extends Functions, ContextInput, O extends string> = Omit<
  {
    build(): Module<Fs, ContextInput>
    name(name: string): ModuleBuilder<Fs, ContextInput, O | 'name'>
    version(version: string): ModuleBuilder<Fs, ContextInput, O | 'version'>
    options(options: ModuleOptions): ModuleBuilder<Fs, ContextInput, O | 'options'>
    context<const NewContextInput>(
      context: Module<Fs, NewContextInput>['context'],
    ): ModuleBuilder<Fs, NewContextInput, Exclude<O | 'context', 'build'>>
    functions<const NewFs extends Functions>(
      functions: Module<NewFs, ContextInput>['functions']['definitions'],
    ): ModuleBuilder<NewFs, ContextInput, Exclude<O | 'functions', 'functionsOptions' | 'context'>>
    functionsOptions(
      options: Exclude<Module<Fs, ContextInput>['functions']['options'], undefined>,
    ): ModuleBuilder<Fs, ContextInput, O | 'functionsOptions'>
  },
  O
>

export const builder: ModuleBuilder<{}, unknown, 'functionsOptions' | 'context' | 'build'> = new ModuleBuilderImpl({})
