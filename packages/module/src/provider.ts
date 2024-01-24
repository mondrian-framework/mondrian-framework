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
 * Utility function to build a {@link ContextProvider}.
 * Any {@link ContextProvider} could be used as context provider or also as a guard.
 *
 * Example:
 * ```typescript
 * import { functions, provider, guard } from '@mondrian-framework/module'
 * import { result } from '@mondrian-framework/model'
 *
 * const authProvider = guard.build({
 *  errors: { unauthorized },
 *  apply: async ({ auth }: { auth: string }) => {
 *    if (false) { // some logic
 *      return result.fail({ ... })
 *    } else {
 *      return result.ok({ userId: '...' })
 *    }
 * })
 *
 * const myFunction = functionDefinition.with({
 *   providers: { auth: authProvider },
 * }).implement({
 *   async body({ input, auth: { userId } }) {
 *     //...
 *   }
 * })
 * ```
 */
export function build<
  const ContextInput extends Record<string, unknown>,
  const Context,
  const Errors extends functions.ErrorType,
>(provider: ContextProvider<ContextInput, Context, Errors>): ContextProvider<ContextInput, Context, Errors> {
  return provider
}
