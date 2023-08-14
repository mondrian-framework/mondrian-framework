import { Function, Functions } from './functions'
import { Logger } from './log'
import { projection, types } from '@mondrian-framework/model'

//TODO: factorize UnionToIntersection to utils package
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never
export type ContextType<F extends Functions> = {
  [K in keyof F]: F[K] extends Function<any, any, infer Context> ? Context : never
} extends infer C
  ? C extends Record<keyof F, unknown>
    ? UnionToIntersection<C[keyof F]>
    : never
  : never

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

export function builder(): ModuleBuilder<{}, unknown> {
  return new ModuleBuilder({})
}

class ModuleBuilder<const Fs extends Functions, const ContextInput> {
  private module: Partial<Module<Fs, ContextInput>>
  constructor(module: Partial<Module<Fs, ContextInput>>) {
    this.module = module
  }
  public build(): Module<Fs, ContextInput> {
    const moduleName = this.module.name ?? 'default'
    const moduleFunctions = this.module.functions
    const moduleContext = this.module.context
    const moduleVersion = this.module.version ?? '0.0.0'
    if (!module || !moduleFunctions || !moduleContext) {
      throw new Error('Module not defined correctly')
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
  public name(name: string): ModuleBuilder<Fs, ContextInput> {
    return new ModuleBuilder({ ...this.module, name })
  }
  public version(version: string): ModuleBuilder<Fs, ContextInput> {
    return new ModuleBuilder({ ...this.module, version })
  }
  public options(options: ModuleOptions): ModuleBuilder<Fs, ContextInput> {
    return new ModuleBuilder({ ...this.module, options })
  }
  public context<const NewContextInput>(
    context: Module<Fs, NewContextInput>['context'],
  ): ModuleBuilder<Fs, NewContextInput> {
    return new ModuleBuilder({ ...this.module, context })
  }
  public functions<const NewFs extends Functions>(
    functions: Module<NewFs, ContextInput>['functions'],
  ): ModuleBuilder<NewFs, ContextInput> {
    return new ModuleBuilder({ ...this.module, functions, context: undefined })
  }
}
