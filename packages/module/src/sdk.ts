import { ContextType, Functions, Module } from './module'
import { buildLogger, randomOperationId } from './utils'
import { Infer, InferProjection, LazyType, Project, Types } from '@mondrian-framework/model'

type SDK<T extends Types, F extends Functions<keyof T extends string ? keyof T : never>> = {
  [K in keyof F]: Infer<T[F[K]['input']]> extends infer Input
    ? InferProjection<T[F[K]['output']]> extends infer Projection
      ? SdkResolver<Input, Projection, T[F[K]['output']]>
      : never
    : never
}

type SdkResolver<Input, Projection, OutputType extends LazyType> = <const P extends Projection>(args: {
  input: Input
  projection?: P
}) => Promise<Project<P, OutputType>>

export function createLocalSdk<
  const T extends Types,
  const F extends Functions<keyof T extends string ? keyof T : never>,
  CI,
>({ module, context }: { module: Module<T, F, CI>; context: () => Promise<ContextType<F>> }): SDK<T, F> {
  const functions = Object.fromEntries(
    Object.entries(module.functions.definitions).map(([functionName, functionBody]) => {
      const wrapper = async ({ input, projection }: { input: any; projection: any }) => {
        const operationId = randomOperationId()
        const log = buildLogger(module.name, operationId, null, functionName, 'LOCAL', new Date())
        const ctx = await context()
        try {
          const result = functionBody.apply({ input, projection, context: ctx, operationId, log })
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
