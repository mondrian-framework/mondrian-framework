import { Functions, Module } from './module'
import { buildLogger, randomOperationId } from './utils'
import { projection, types } from '@mondrian-framework/model'

type SDK<F extends Functions, Metadata> = {
  [K in keyof F]: SdkResolver<F[K]['input'], F[K]['output'], Metadata>
}

type SdkResolver<InputType extends types.Type, OutputType extends types.Type, Metadata> = <
  P extends projection.Infer<OutputType> | undefined = true, //TODO with default true intellisense do not suggest projection
>(args: {
  input: types.Infer<InputType> //TODO: defaults should be optional
  projection?: P
  metadata?: Metadata
}) => Promise<projection.Project<OutputType, Exclude<P, undefined>>>
//const F extends Functions, const CI
export function fromModule<const Metadata = unknown>(): <const F extends Functions, const CI>(args: {
  module: Module<F, CI>
  context: (args: { metadata?: Metadata }) => Promise<CI>
}) => SDK<F, Metadata> {
  return <const F extends Functions, const CI>({
    module,
    context,
  }: {
    module: Module<F, CI>
    context: (args: { metadata?: Metadata }) => Promise<CI>
  }) => {
    const functions = Object.fromEntries(
      Object.entries(module.functions.definitions).map(([functionName, functionBody]) => {
        const wrapper = async ({
          input,
          projection,
          metadata,
        }: {
          input: any
          projection: any
          metadata?: Metadata
        }) => {
          const operationId = randomOperationId()
          const log = buildLogger(module.name, operationId, null, functionName, 'LOCAL', new Date())
          const contextInput = await context({ metadata })
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
    return functions as SDK<F, Metadata>
  }
}
