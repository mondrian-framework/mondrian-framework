import { Functions, Module } from './module'
import { buildLogger, randomOperationId } from './utils'
import { projection, types } from '@mondrian-framework/model'

type SDK<F extends Functions> = {
  [K in keyof F]: SdkResolver<F[K]['input'], F[K]['output']>
}

//TODO: need shaders
type SdkResolver<InputType extends types.Type, OutputType extends types.Type> = <
  P extends projection.Infer<OutputType>,
>(args: {
  input: types.Infer<InputType>
  projection?: P
}) => Promise<
  [P] extends [projection.Infer<OutputType>]
    ? types.Infer<OutputType>
    : types.Infer<projection.ProjectedType<OutputType, P>>
>

export function fromModule<const F extends Functions, CI>({
  module,
  context,
}: {
  module: Module<F, CI>
  context: () => Promise<CI>
}): SDK<F> {
  const functions = Object.fromEntries(
    Object.entries(module.functions.definitions).map(([functionName, functionBody]) => {
      const wrapper = async ({ input, projection }: { input: any; projection: any }) => {
        const operationId = randomOperationId()
        const log = buildLogger(module.name, operationId, null, functionName, 'LOCAL', new Date())
        const contextInput = await context()
        const ctx = await module.context(contextInput)
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

  return functions as SDK<F>
}
