import { Functions, Module } from './module'
import { buildLogger, randomOperationId } from './utils'
import { projection, types } from '@mondrian-framework/model'

type Sdk<F extends Functions, Metadata> = {
  functions: SdkFunctions<F, Metadata>
  with: (metadata: Metadata) => Sdk<F, Metadata>
}

type SdkFunctions<F extends Functions, Metadata> = {
  [K in keyof F]: SdkFunction<F[K]['input'], F[K]['output'], Metadata>
}

type SdkFunction<InputType extends types.Type, OutputType extends types.Type, Metadata> = <
  P extends projection.Infer<OutputType> | undefined = true, //TODO with default true intellisense do not suggest projection
>(
  input: types.Infer<InputType>, //TODO: defaults should be optional
  options?: {
    projection?: P
    metadata?: Metadata
  },
) => Promise<projection.Project<OutputType, Exclude<P, undefined>>>

//const F extends Functions, const CI
export function fromModule<const Metadata = unknown>(
  metadata?: Metadata,
): <const F extends Functions, const CI>(args: {
  module: Module<F, CI>
  context: (args: { metadata?: Metadata }) => Promise<CI>
}) => Sdk<F, Metadata> {
  return <const F extends Functions, const CI>({
    module,
    context,
  }: {
    module: Module<F, CI>
    context: (args: { metadata?: Metadata }) => Promise<CI>
  }) => {
    const functions = Object.fromEntries(
      Object.entries(module.functions.definitions).map(([functionName, functionBody]) => {
        const wrapper = async (
          input: any,
          options?: {
            projection?: any
            metadata?: Metadata
          },
        ) => {
          const operationId = randomOperationId()
          const log = buildLogger(module.name, operationId, null, functionName, 'LOCAL', new Date())
          try {
            const contextInput = await context({ metadata: options?.metadata ?? metadata })
            const ctx = await module.context(contextInput, { input, projection: options?.projection, operationId, log })
            const result = await functionBody.apply({ input, projection, context: ctx, operationId, log })
            log('Done.')
            return result
          } catch (error) {
            log(error instanceof Error ? `Call failed. ${error.message}` : `Call failed.`)
            throw error
          }
        }
        return [functionName, wrapper]
      }),
    )
    return {
      functions: functions as SdkFunctions<F, Metadata>,
      with: (metadata) => fromModule(metadata)({ module, context }),
    }
  }
}
