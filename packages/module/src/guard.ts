import { functions, provider } from '.'
import { model, result } from '@mondrian-framework/model'

type GuardDefinition<ContextInput extends Record<string, unknown>, Errors extends functions.ErrorType> = {
  readonly errors?: Errors
  readonly apply: (input: ContextInput) => ApplyResult<Errors>
}

type ApplyResult<Errors extends functions.ErrorType> = [Exclude<Errors, undefined>] extends [
  infer E1 extends model.Types,
]
  ? Promise<result.Failure<functions.InferErrorType<E1>> | void>
  : Promise<result.Failure<never> | void>

/**
 * Utility function to build a guard.
 * A guard is a context provider that always provide an 'undefined' resource.
 */
export function build<const ContextInput extends Record<string, unknown>, const Errors extends functions.ErrorType>(
  guard: GuardDefinition<ContextInput, Errors>,
): provider.ContextProvider<ContextInput, undefined, Errors> {
  return {
    errors: guard.errors,
    apply: (async (input) => {
      const res = await guard.apply(input)
      if (!res) {
        return result.ok()
      } else {
        return res
      }
    }) as provider.ContextProvider<ContextInput, undefined, Errors>['apply'],
  }
}
