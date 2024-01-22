import { functions, logger, retrieve } from '.'
import { model, result } from '@mondrian-framework/model'

type GenericFunctionArgs = {
  input: unknown
  retrieve: retrieve.GenericRetrieve | undefined
  tracer: functions.Tracer
  logger: logger.MondrianLogger
}

/**
 * A context provider is a utility that takes an arbitraty ContextInput and returns a piece of information
 * that will be propagated to the function input. The ContextInput instead will be requested from the runtime.
 */
export type ContextProvider<
  ContextInput extends Record<string, unknown>,
  Context,
  Errors extends functions.ErrorType,
> = {
  readonly errors?: Errors
  readonly apply: (
    input: ContextInput,
  ) => [Exclude<Errors, undefined>] extends [infer E1 extends model.Types]
    ? Promise<result.Result<Context, functions.InferErrorType<E1>>>
    : Promise<result.Result<Context, never>>
}

/**
 * Utility function to build a context provider.
 */
export function build<
  const ContextInput extends Record<string, unknown>,
  const Context,
  const Errors extends functions.ErrorType,
>(provider: ContextProvider<ContextInput, Context, Errors>): ContextProvider<ContextInput, Context, Errors> {
  return provider
}
