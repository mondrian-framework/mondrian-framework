import { Operations, Module, ModuleDefinition } from './mondrian'
import { Infer, Projection, Types } from './type-system'

type SDK<T extends Types, O extends Operations<T>> = {
  query: {
    [K in keyof O['queries']]: Infer<T[O['queries'][K]['input']]> extends infer Input
      ? Infer<T[O['queries'][K]['output']]> extends infer Output
        ? SdkResolver<Input, Output>
        : never
      : never
  }
  mutation: {
    [K in keyof O['mutations']]: Infer<T[O['mutations'][K]['input']]> extends infer Input
      ? Infer<T[O['mutations'][K]['output']]> extends infer Output
        ? SdkResolver<Input, Output>
        : never
      : never
  }
}

type SdkResolver<Input, Output> = <const P extends Projection<Output>>(args: {
  input: Input
  headers?: Record<string, string | string[] | undefined>
  fields?: P
}) => Promise<Project<Output, P>>

type Project<T, P> = T extends object
  ? P extends object
    ? {
        //@ts-ignore
        [K in keyof P]: Project<T[K], P[K]>
      }
    : T
  : T

export function sdk<const T extends Types, const O extends Operations<T>>({
  module,
  defaultHeaders,
}: {
  module: Module<T, O, any> | ModuleDefinition<T, O>
  defaultHeaders?: Record<string, string | string[] | undefined>
}): SDK<T, O> {
  if ('resolvers' in module) {
    const queries = Object.fromEntries(
      Object.entries(module.resolvers.queries).map(([query, body]) => {
        const resolver = body.f
        const wrapper = async ({ input, fields, headers }: { input: any; headers?: any; fields: any }) => {
          const context = await module.context({ headers: { ...defaultHeaders, ...headers } })
          return resolver({ input, fields, context })
        }
        return [query, wrapper]
      }),
    )
    const mutations = Object.fromEntries(
      Object.entries(module.resolvers.mutations).map(([query, body]) => {
        const resolver = body.f
        const wrapper = async ({ input, fields, headers }: { input: any; headers?: any; fields: any }) => {
          const context = await module.context({ headers: { ...defaultHeaders, ...headers } })
          return resolver({ input, fields, context })
        }
        return [query, wrapper]
      }),
    )
    return {
      query: queries,
      mutation: mutations,
    } as SDK<T, O>
  }
  return null as any
}
