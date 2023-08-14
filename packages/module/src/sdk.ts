import { logger } from '.'
import { Functions } from './functions'
import { Module } from './module'
import { randomOperationId } from './utils'
import { projection, types } from '@mondrian-framework/model'

export type Sdk<F extends Functions, Metadata> = {
  functions: SdkFunctions<F, Metadata>
  withMetadata: (metadata: Metadata) => Sdk<F, Metadata>
}

type SdkFunctions<F extends Functions, Metadata> = {
  [K in keyof F]: SdkFunction<F[K]['input'], F[K]['output'], Metadata>
}

type SdkFunction<InputType extends types.Type, OutputType extends types.Type, Metadata> = <
  P extends projection.FromType<OutputType> | undefined = true, //TODO with default true intellisense do not suggest projection
>(
  input: types.Infer<InputType>, //TODO: defaults should be optional
  options?: {
    projection?: P
    metadata?: Metadata
  },
) => Promise<any> //TODO: Promise<projection.Project<OutputType, Exclude<P, undefined>>>

class SdkBuilder<const Metadata = unknown> {
  private _metadata?: Metadata
  constructor(metadata?: Metadata) {
    this._metadata = metadata
  }
  public metadata<const NewMetadata>(args?: { metadata?: NewMetadata }): SdkBuilder<NewMetadata> {
    return new SdkBuilder(args?.metadata)
  }
  public build<const F extends Functions, const CI>({
    module,
    context,
  }: {
    module: Module<F, CI>
    context: (args: { metadata?: Metadata }) => Promise<CI>
  }): Sdk<F, Metadata> {
    const defaultLogger = logger.with({ moduleName: module.name, server: 'LOCAL' })
    const functions = Object.fromEntries(
      Object.entries(module.functions.definitions).map(([functionName, functionBody]) => {
        const wrapper = async (
          input: any,
          options?: {
            projection?: projection.Projection
            metadata?: Metadata
          },
        ) => {
          const operationId = randomOperationId()
          const log = defaultLogger.with({ operationId, operationName: functionName }).build()
          try {
            const contextInput = await context({ metadata: options?.metadata ?? this._metadata })
            const ctx = await module.context(contextInput, { input, projection: options?.projection, operationId, log })
            const result = await functionBody.apply({
              input: input as never, //TODO: types.Infer<types.Type> should infer unknown
              projection: options?.projection as never, //TODO: projection.FromType<types.Type> should infer Projection
              context: ctx,
              operationId,
              log,
            })
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
      functions: functions as unknown as SdkFunctions<F, Metadata>,
      withMetadata: (metadata) => new SdkBuilder().metadata({ metadata }).build({ module, context }),
    }
  }
}

export const builder: SdkBuilder = new SdkBuilder()
