import { functions, provider } from '.'
import { model, result } from '@mondrian-framework/model'

type GuardDefinition<
  ContextInput extends Record<string, unknown>,
  Errors extends functions.ErrorType,
  Pv extends provider.Providers,
> = {
  readonly errors?: Errors
  readonly body: (
    input: ContextInput,
    args: functions.GenericFunctionArguments & provider.ProvidersToContext<Pv>,
  ) => ApplyResult<Errors>
}

type ApplyResult<Errors extends functions.ErrorType> = [Exclude<Errors, undefined>] extends [
  infer E1 extends model.Types,
]
  ? Promise<result.Failure<functions.InferErrorType<E1>> | void>
  : Promise<result.Failure<never> | void>

/**
 * Utility function to build a guard.
 * A guard is a {@link provider.ContextProvider ContextProvider} that always provide an 'undefined' resource.
 * If used as a guard on a function implementation the provided value will be omitted but the guard logic will run.
 *
 * Example:
 * ```typescript
 * import { functions, provider, guard } from '@mondrian-framework/module'
 * import { result } from '@mondrian-framework/model'
 *
 * const authGuard = guard.build({
 *  errors: { unauthorized },
 *  apply: async ({ auth }: { auth: string }) => {
 *    if (true) { // some logic
 *      return result.fail({ ... })
 *    }
 * })
 *
 * const myFunction = functionDefinition.use({
 *   guards: { auth: authGuard },
 * }).implement({
 *   //...
 * })
 * ```
 */
export function build<const ContextInput extends Record<string, unknown>, const Errors extends functions.ErrorType>(
  guard: GuardDefinition<ContextInput, Errors, {}>,
): provider.ContextProvider<ContextInput, undefined, Errors, {}> {
  return use({ providers: {} }).build(guard)
}

export function use<const Pv extends provider.Providers>({ providers }: { providers: Pv }) {
  function build<const ContextInput extends Record<string, unknown>, const Errors extends functions.ErrorType>(
    guard: GuardDefinition<ContextInput, Errors, Pv>,
  ): provider.ContextProvider<ContextInput, undefined, Errors, Pv> {
    return provider.use({ providers }).build({
      errors: guard.errors,
      body: (async (input, args) => {
        const res = await guard.body(input, args as any)
        if (!res) {
          return result.ok()
        } else {
          return res
        }
      }) as provider.ContextProvider<ContextInput, undefined, Errors>['body'],
    })
  }
  return { build }
}

/**
 * A map of {@link provider.ContextProvider ContextProvider}s.
 */
export type Guards = {
  [K in string]: provider.ContextProvider<any, any>
}
