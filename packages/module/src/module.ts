import { Logger } from './utils'
import {
  GenericProjection,
  Infer,
  InferProjection,
  InferReturn,
  LazyType,
  getProjectedType,
  lazyToType,
  projectionDepth,
  validate,
} from '@mondrian-framework/model'

export type Function<I extends LazyType, O extends LazyType, Context> = Infer<I> extends infer Input
  ? InferReturn<O> extends infer Output
    ? InferProjection<O> extends infer Projection
      ? {
          input: I
          output: O
          namespace?: string
          apply: (args: {
            input: Input
            projection: Projection | undefined
            operationId: string
            context: Context
            log: Logger
          }) => Promise<Output>
        }
      : never
    : never
  : never
export type GenericFunction = {
  input: LazyType
  output: LazyType
  namespace?: string
  apply: (args: { input: any; projection: any; context: any; operationId: string; log: Logger }) => Promise<unknown>
  opts?: { description?: string }
}

export type Functions = Record<string, GenericFunction>

export function functionBuilder<const Context>(args?: {
  namespace?: string
}): <const I extends LazyType, const O extends LazyType>(
  f: Function<I, O, Context>,
  opts?: { description?: string },
) => Function<I, O, Context> & { opts?: { description?: string } } {
  function builder<const I extends LazyType, const O extends LazyType>(
    f: Function<I, O, Context>,
    opts?: { description?: string },
  ): Function<I, O, Context> & { opts?: { description?: string } } {
    return { ...f, opts, namespace: f.namespace ?? args?.namespace }
  }
  return builder
}

export function func<const I extends LazyType, const O extends LazyType, const Context>(
  f: Function<I, O, Context>,
): Function<I, O, Context> {
  return f
}

export function functions<const F extends Functions>(functions: F): F {
  return functions
}

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
  context: (input: any) => Promise<unknown>
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
  context: (input: CI) => Promise<ContextType<F>>
  options?: ModuleOptions
}

export type ModuleOptions = {
  checks?: {
    output?: 'ignore' | 'log' | 'throw'
    maxProjectionDepth?: number
  }
}

function gatherTypes(types: LazyType[], explored?: Set<LazyType>): LazyType[] {
  explored = explored ?? new Set<LazyType>()
  for (const type of types) {
    if (explored.has(type)) {
      continue
    }
    explored.add(type)
    const t = lazyToType(type)
    if (
      t.kind === 'array-decorator' ||
      t.kind === 'default-decorator' ||
      t.kind === 'nullable-decorator' ||
      t.kind === 'optional-decorator' ||
      t.kind === 'relation-decorator'
    ) {
      gatherTypes([t.type], explored)
    } else if (t.kind === 'object') {
      gatherTypes(Object.values(t.type), explored)
    } else if (t.kind === 'union-operator') {
      gatherTypes(Object.values(t.types), explored)
    }
  }
  return [...explored.values()]
}
function gatherNames(types: LazyType[]): string[] {
  const names: string[] = []
  for (const type of types) {
    const t = lazyToType(type)
    if (t.opts?.name) {
      names.push(t.opts.name)
    }
  }
  return names
}

export function module<const F extends Functions, CI>(module: Module<F, CI>): Module<F, CI> {
  //check for double type names
  const allTypes = gatherTypes(Object.values(module.functions.definitions).flatMap((f) => [f.input, f.output]))
  const allNames = gatherNames(allTypes)
  for (let i = 0; i < allNames.length; i++) {
    if (allNames.indexOf(allNames[i]) !== i) {
      throw new Error(`Duplicated type name "${allNames[i]}"`)
    }
  }
  const outputTypeCheck = module.options?.checks?.output ?? 'throw'
  const maxProjectionDepth = module.options?.checks?.maxProjectionDepth ?? null
  const functions = Object.fromEntries(
    Object.entries(module.functions.definitions).map(([functionName, functionBody]) => {
      const f: GenericFunction = {
        ...functionBody,
        async apply(args) {
          //PROJECTION DEPTH
          if (maxProjectionDepth != null) {
            const depth = projectionDepth(args.projection)
            if (depth > maxProjectionDepth) {
              throw new Error(`Max projection depth reached: ${depth}`)
            }
          }

          const result = await functionBody.apply(args)

          //OUTPUT CHECK
          if (outputTypeCheck !== 'ignore') {
            const projectedType = getProjectedType(functionBody.output, args.projection as GenericProjection)
            const isCheck = validate(projectedType, result, { strict: false })
            if (!isCheck.success) {
              const m = JSON.stringify({ projection: args.projection, errors: isCheck.errors })
              if (outputTypeCheck === 'log') {
                args.log(`Invalid output: ${m}`, 'error')
              } else {
                throw new Error(`Invalid output: ${m}`)
              }
            }
          }
          return result
        },
      }
      return [functionName, f]
    }),
  )
  return { ...module, functions: { definitions: functions as F, options: module.functions.options } }
}
