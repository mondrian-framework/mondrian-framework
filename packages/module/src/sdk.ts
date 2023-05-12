import { Infer, InferProjection, LazyType, Project, Types } from '@mondrian/model'
import { buildLogger, randomOperationId } from './utils'
import { ContextType, Functions, Module } from './module'

type SDK<T extends Types, F extends Functions<keyof T extends string ? keyof T : never>> = {
  [K in keyof F]: Infer<T[F[K]['input']]> extends infer Input
    ? InferProjection<T[F[K]['output']]> extends infer Fields
      ? SdkResolver<Input, Fields, T[F[K]['output']]>
      : never
    : never
}

type SdkResolver<Input, Fields, OutputType extends LazyType> = <const F extends Fields>(args: {
  input: Input
  fields?: F
}) => Promise<Project<F, OutputType>>

export function createLocalSdk<
  const T extends Types,
  const F extends Functions<keyof T extends string ? keyof T : never>,
>({ module, context }: { module: Module<T, F>; context: () => Promise<ContextType<F>> }): SDK<T, F> {
  const functions = Object.fromEntries(
    Object.entries(module.functions).map(([functionName, functionBody]) => {
      const wrapper = async ({ input, fields }: { input: any; fields: any }) => {
        const operationId = randomOperationId()
        const log = buildLogger(module.name, operationId, null, functionName, 'LOCAL', new Date())
        const ctx = await context()
        try {
          const result = functionBody.apply({ input, fields, context: ctx, operationId, log })
          log('Done.')
          return result
        } catch {
          log('Call failed.')
        }
      }
      return [functionName, wrapper]
    }),
  )

  return functions as SDK<T, F>
}
