import { Logger } from './utils'
import {
  GenericProjection,
  Infer,
  InferProjection,
  InferReturn,
  Types,
  getProjectedType,
  projectionDepth,
  validate,
} from '@mondrian-framework/model'

export type Function<T extends Types, I extends keyof T, O extends keyof T, Context> = Infer<T[I]> extends infer Input
  ? InferReturn<T[O]> extends infer Output
    ? InferProjection<T[O]> extends infer Projection
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
export type GenericFunction<TypesName extends string = string> = {
  input: TypesName
  output: TypesName
  namespace?: string
  apply: (args: { input: any; projection: any; context: any; operationId: string; log: Logger }) => Promise<unknown>
  opts?: { description?: string }
}

export type Functions<Types extends string = string> = Record<string, GenericFunction<Types>>

export function functionBuilder<const T extends Types, Context>(args?: {
  namespace?: string
}): <const I extends keyof T, const O extends keyof T>(
  f: Function<T, I, O, Context>,
  opts?: { description?: string },
) => Function<T, I, O, Context> & { opts?: { description?: string } } {
  function builder<const I extends keyof T, const O extends keyof T>(
    f: Function<T, I, O, Context>,
    opts?: { description?: string },
  ): Function<T, I, O, Context> & { opts?: { description?: string } } {
    return { ...f, opts, namespace: f.namespace ?? args?.namespace }
  }
  return builder
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
  types: Types
  version: string
  functions: {
    definitions: Record<string, GenericFunction>
    options?: Partial<Record<string, { authentication?: AuthenticationMethod | 'NONE' }>>
  }
  authentication?: AuthenticationMethod
  context: (input: any) => Promise<unknown>
  options?: ModuleOptions
}

export type Module<T extends Types, F extends Functions<keyof T extends string ? keyof T : string>, CI> = {
  name: string
  version: string
  types: T
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

export function module<const T extends Types, const F extends Functions<keyof T extends string ? keyof T : string>, CI>(
  module: Module<T, F, CI>,
): Module<T, F, CI> {
  const outputTypeCheck = module.options?.checks?.output ?? 'throw'
  const maxProjectionDepth = module.options?.checks?.maxProjectionDepth ?? null
  const functions = Object.fromEntries(
    Object.entries(module.functions.definitions).map(([functionName, functionBody]) => {
      const outputType = module.types[functionBody.output]
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
            const projectedType = getProjectedType(outputType, args.projection as GenericProjection)
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
