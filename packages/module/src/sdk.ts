import { logger } from '.'
import { Functions } from './function'
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

class SdkBuilderImpl<const F extends Functions, const ContextInput, const Metadata> {
  private _metadata?: Metadata
  private _module?: Module<F, ContextInput>
  private _context?: (args: { metadata?: Metadata }) => Promise<ContextInput>

  constructor(
    module?: Module<F, ContextInput>,
    context?: (args: { metadata?: Metadata }) => Promise<ContextInput>,
    metadata?: Metadata,
  ) {
    this._module = module
    this._context = context
    this._metadata = metadata
  }
  public module<const F extends Functions, const ContextInput>(
    m?: Module<F, ContextInput>,
  ): SdkBuilderImpl<F, ContextInput, Metadata> {
    return new SdkBuilderImpl(m, undefined, this._metadata)
  }
  public metadata<const Metadata>(metadata?: Metadata): SdkBuilderImpl<F, ContextInput, Metadata> {
    return new SdkBuilderImpl(this._module, undefined, metadata)
  }
  public context(
    context?: (args: { metadata?: Metadata }) => Promise<ContextInput>,
  ): SdkBuilderImpl<F, ContextInput, Metadata> {
    return new SdkBuilderImpl(this._module, context, this._metadata)
  }
  public build(): Sdk<F, Metadata> {
    const m = this._module
    const context = this._context
    if (!m || !context) {
      throw new Error(`You need to use '.module' and '.context' before`)
    }
    const defaultLogger = logger.context({ moduleName: m.name, server: 'LOCAL' })
    const functions = Object.fromEntries(
      Object.entries(m.functions.definitions).map(([functionName, functionBody]) => {
        const wrapper = async (
          input: any,
          options?: {
            projection?: projection.Projection
            metadata?: Metadata
          },
        ) => {
          const operationId = randomOperationId()
          const log = defaultLogger.context({ operationId, operationName: functionName }).build()
          try {
            const contextInput = await context({ metadata: options?.metadata ?? this._metadata })
            const ctx = await m.context(contextInput, { input, projection: options?.projection, operationId, log })
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
      withMetadata: (metadata) => builder.metadata(metadata).module(m).context(context).build(),
    }
  }
}

type SdkBuilder<F extends Functions, ContextInput, Metadata, E extends string> = Omit<
  {
    module<const F extends Functions, ContextInput>(
      module: Module<F, ContextInput>,
    ): SdkBuilder<F, ContextInput, Metadata, Exclude<E | 'module', 'context'>>
    metadata<const Metadata>(
      metadata?: Metadata,
    ): SdkBuilder<F, ContextInput, Metadata, Exclude<E | 'build', 'context'>>
    context(
      context: (args: { metadata?: Metadata }) => Promise<ContextInput>,
    ): SdkBuilder<F, ContextInput, Metadata, Exclude<E, 'build'>>
    build(): Sdk<F, Metadata>
  },
  E
>

export const builder: SdkBuilder<{}, unknown, unknown, 'build' | 'context'> = new SdkBuilderImpl()
