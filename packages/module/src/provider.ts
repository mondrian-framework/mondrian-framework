import { functions, logger, retrieve } from '.'
import { model, result } from '@mondrian-framework/model'

type GenericFunctionArgs = {
  input: unknown
  retrieve: retrieve.GenericRetrieve | undefined
  tracer: functions.Tracer
  logger: logger.MondrianLogger
}

export type ContextProvider<
  ContextInput extends Record<string, unknown>,
  Context,
  Errors extends functions.ErrorType,
> = {
  readonly errors?: Errors
  readonly body: (
    input: ContextInput,
    args: GenericFunctionArgs,
  ) => [Exclude<Errors, undefined>] extends [infer E1 extends model.Types]
    ? Promise<result.Result<Context, functions.InferErrorType<E1>>>
    : Promise<result.Result<Context, never>>
}

export function build<
  const ContextInput extends Record<string, unknown>,
  const Context,
  const Errors extends functions.ErrorType,
>(provider: ContextProvider<ContextInput, Context, Errors>): ContextProvider<ContextInput, Context, Errors> {
  return provider
}
