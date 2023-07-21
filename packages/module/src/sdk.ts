import { Functions, Module } from './module'
import { buildLogger, randomOperationId } from './utils'
import { GenericProjection, Infer, InferProjection, LazyType, Project } from '@mondrian-framework/model'

type SDK<F extends Functions, Info> = {
  [K in keyof F]: Infer<F[K]['input']> extends infer Input //TODO: defaults should be optional
    ? InferProjection<F[K]['output']> extends infer Projection
      ? SdkResolver<Input, Projection, F[K]['output'], Info>
      : never
    : never
}

//TODO: how to remove the tsignore?
//@ts-ignore
type SdkResolver<Input, Projection, OutputType extends LazyType, Info> = <const P extends Projection = true>(args: {
  input: Input
  projection?: P
  info?: Info
}) => Promise<Project<P, OutputType>>

export function createLocalSdk<const F extends Functions, CI, Info>({
  module,
  context,
}: {
  module: Module<F, CI>
  context: (args: { info?: Info }) => Promise<CI>
}): SDK<F, Info> {
  const functions = Object.fromEntries(
    Object.entries(module.functions.definitions).map(([functionName, functionBody]) => {
      const wrapper = async ({ input, projection, info }: { input: any; projection: any; info?: Info }) => {
        const operationId = randomOperationId()
        const log = buildLogger(module.name, operationId, null, functionName, 'LOCAL', new Date())
        const contextInput = await context({ info })
        const ctx = await module.context(contextInput, { input, projection, operationId, log })
        try {
          const result = await functionBody.apply({ input, projection, context: ctx, operationId, log })
          log('Done.')
          return result
        } catch {
          log('Call failed.')
        }
      }
      return [functionName, wrapper]
    }),
  )
  return functions as SDK<F, Info>
}
