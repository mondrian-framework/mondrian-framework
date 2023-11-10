import { functions, module, utils } from '.'
import { logger as mondrianLogger } from '.'
import { ErrorType } from './function'
import { retrieve, result, model } from '@mondrian-framework/model'

export type Sdk<F extends functions.Functions, Metadata> = {
  functions: SdkFunctions<F, Metadata>
  withMetadata: (metadata: Metadata) => Sdk<F, Metadata>
}

type SdkFunctions<F extends functions.Functions, Metadata> = {
  [K in keyof F]: SdkFunction<F[K]['input'], F[K]['output'], F[K]['errors'], F[K]['retrieve'], Metadata>
}

type SdkFunction<
  InputType extends model.Type,
  OutputType extends model.Type,
  E extends ErrorType,
  C extends retrieve.Capabilities | undefined,
  Metadata,
> = <const P extends retrieve.FromType<OutputType, C>>(
  input: model.Infer<InputType>,
  options?: { retrieve?: any /*P*/; metadata?: Metadata; operationId?: string },
) => Promise<SdkFunctionResult<OutputType, E, C, P>>

type SdkFunctionResult<
  O extends model.Type,
  E extends ErrorType,
  C extends retrieve.Capabilities | undefined,
  P extends retrieve.FromType<O, C>,
> = any // TODO [E] extends [model.Types] ? result.Result<Project<O, P>, { [K in keyof E]: model.Infer<E[K]> }> : Project<O, P>

/**
 * Infer a subset of a Mondrian type `T` based on a retrieve `P`
 * If not explicitly required, all embedded entities are excluded.
 **/
// prettier-ignore
export type Project<T extends model.Type, P extends retrieve.GenericRetrieve> //TODO
  = [P] extends [Record<string, unknown>] ? model.Infer<model.PartialDeep<T>> 
  : model.Infer<T>

class SdkBuilder<const Metadata> {
  private metadata?: Metadata

  constructor(metadata?: Metadata) {
    this.metadata = metadata
  }

  public build<const Fs extends functions.Functions, ContextInput>({
    module,
    context,
  }: {
    module: module.Module<Fs, ContextInput>
    context: (args: { metadata?: Metadata }) => Promise<ContextInput>
  }): Sdk<Fs, Metadata> {
    const presetLogger = mondrianLogger.build({ moduleName: module.name, server: 'LOCAL' })
    const fs = Object.fromEntries(
      Object.entries(module.functions).map(([functionName, func]) => {
        const wrapper = async (
          input: unknown,
          options?: {
            retrieve?: retrieve.GenericRetrieve
            metadata?: Metadata
            operationId?: string
          },
        ) => {
          const operationId = options?.operationId ?? utils.randomOperationId()
          const thisLogger = presetLogger.updateContext({ operationId, operationName: functionName })
          try {
            const contextInput = await context({ metadata: options?.metadata ?? this.metadata })
            const ctx = await module.context(contextInput, {
              input,
              retrieve: options?.retrieve,
              operationId,
              logger: thisLogger,
            })
            const result = await func.apply({
              input: input as never,
              retrieve: options?.retrieve ?? {},
              context: ctx,
              operationId,
              logger: thisLogger,
            })
            thisLogger.logInfo('Done.')
            return result
          } catch (error) {
            thisLogger.logError(error instanceof Error ? `Call failed. ${error.message}` : `Call failed.`)
            throw error
          }
        }
        return [functionName, wrapper]
      }),
    )
    return {
      functions: fs as unknown as SdkFunctions<Fs, Metadata>,
      withMetadata: (metadata) => withMetadata(metadata).build({ module, context }),
    }
  }
}

export function withMetadata<const Metadata>(metadata?: Metadata): SdkBuilder<Metadata> {
  return new SdkBuilder(metadata)
}

export function build<const Fs extends functions.Functions, ContextInput>(args: {
  module: module.Module<Fs, ContextInput>
  context: (args: { metadata?: unknown }) => Promise<ContextInput>
}): Sdk<Fs, unknown> {
  return withMetadata().build(args)
}
