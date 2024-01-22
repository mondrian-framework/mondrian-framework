import { functions } from '.'
import { model, result } from '@mondrian-framework/model'

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
  readonly apply: (input: ContextInput) => ApplyResult<Context, Errors>
}

type ApplyResult<Context, Errors extends functions.ErrorType> = [Exclude<Errors, undefined>] extends [
  infer E1 extends model.Types,
]
  ? Promise<result.Result<Context, functions.InferErrorType<E1>>>
  : Promise<result.Ok<Context>>

/**
 * Utility function to build a context provider.
 * A provider can also be used as a guard.
 */
export function build<
  const ContextInput extends Record<string, unknown>,
  const Context,
  const Errors extends functions.ErrorType,
>(provider: ContextProvider<ContextInput, Context, Errors>): ContextProvider<ContextInput, Context, Errors> {
  return provider
}
