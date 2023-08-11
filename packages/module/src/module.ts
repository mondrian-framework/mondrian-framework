import { Logger } from './utils'
import { projection, types } from '@mondrian-framework/model'

export type Function<I extends types.Type, O extends types.Type, Context> = {
  input: I
  output: O
  namespace?: string
  apply: (args: {
    input: types.Infer<I>
    projection: projection.Infer<O> | undefined
    operationId: string
    context: Context
    log: Logger
  }) => Promise<types.Infer<O>> //TODO InferPartialDeep
}

export type GenericFunction = {
  input: types.Type
  output: types.Type
  namespace?: string
  apply: (args: { input: any; projection: any; context: any; operationId: string; log: Logger }) => Promise<unknown>
  opts?: { description?: string }
}

export type Functions = Record<string, GenericFunction>

export function functionBuilder<const Context>(args?: {
  namespace?: string
}): <const I extends types.Type, const O extends types.Type>(
  f: Function<I, O, Context>,
  opts?: { description?: string },
) => Function<I, O, Context> & { opts?: { description?: string } } {
  function builder<const I extends types.Type, const O extends types.Type>(
    f: Function<I, O, Context>,
    opts?: { description?: string },
  ): Function<I, O, Context> & { opts?: { description?: string } } {
    return { ...f, opts, namespace: f.namespace ?? args?.namespace }
  }
  return builder
}

//TODO: factorize UnionToIntersection to utils package
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never
export type ContextType<F extends Functions> = {
  [K in keyof F]: F[K] extends {
    apply: (args: { context: infer C; input: any; projection: any; operationId: any; log: any }) => any
  }
    ? C
    : never
} extends infer C
  ? C extends Record<keyof F, unknown>
    ? UnionToIntersection<C[keyof F]>
    : never
  : never

export type AuthenticationMethod = { type: 'bearer'; format: 'jwt' }
export type GenericModule = {
  name: string
  version: string
  functions: {
    definitions: Record<string, GenericFunction>
    options?: Partial<Record<string, { authentication?: AuthenticationMethod | 'NONE' }>>
  }
  authentication?: AuthenticationMethod
  context: (
    input: any,
    args: {
      input: unknown
      projection: undefined //TODO: GenericProjection
      operationId: string
      log: Logger
    },
  ) => Promise<unknown>
  options?: ModuleOptions
}

export type Module<F extends Functions, CI> = {
  name: string
  version: string
  functions: {
    definitions: F
    options?: { [K in keyof F]?: { authentication?: AuthenticationMethod | 'NONE' } }
  }
  authentication?: AuthenticationMethod
  context: (
    input: CI,
    args: {
      input: unknown
      projection: undefined //TODO: GenericProjection
      operationId: string
      log: Logger
    },
  ) => Promise<ContextType<F>>
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
        gatherTypes(Object.values(t.types), explored)
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

export function define<const CI = unknown>(): <const F extends Functions>(module: Module<F, CI>) => Module<F, CI> {
  return <const F extends Functions>(module: Module<F, CI>) => {
    assertUniqueNames(module.functions.definitions)
    const outputTypeCheck = module.options?.checks?.output ?? 'throw'
    const maxProjectionDepth = module.options?.checks?.maxProjectionDepth
    const functions = Object.fromEntries(
      Object.entries(module.functions.definitions).map(([functionName, functionBody]) => {
        const f: GenericFunction = {
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
    return { ...module, functions: { definitions: functions as F, options: module.functions.options } }
  }
}
