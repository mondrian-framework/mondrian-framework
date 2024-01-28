import { functions } from '.'
import { reservedProvidersNames } from './utils'
import { model, result } from '@mondrian-framework/model'
import { UnionToIntersection } from '@mondrian-framework/utils'

/**
 * A context provider is a utility that takes an arbitraty ContextInput and returns a piece of information
 * that will be propagated to the function input. The ContextInput instead will be requested from the runtime.
 */
export interface ContextProvider<
  ContextInput extends { [K in string]: unknown } = { [K in string]: unknown },
  Context = unknown,
  Errors extends functions.ErrorType = functions.ErrorType,
  Pv extends Providers = Providers,
> {
  readonly errors?: Errors
  readonly providers: Pv
  readonly body: (
    input: ContextInput,
    args: functions.GenericFunctionArguments & ProvidersToContext<Pv>,
  ) => ApplyResult<Context, Errors>
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
  const ContextInput extends { [K in string]: unknown },
  const Context,
  const Errors extends functions.ErrorType,
>(
  provider: Omit<ContextProvider<ContextInput, Context, Errors, {}>, 'providers'>,
): ContextProvider<ContextInput, Context, Errors, {}> {
  return dependsOn({}).build(provider)
}

export function dependsOn<const Pv extends Providers>(providers: Pv) {
  for (const providerName of Object.keys(providers)) {
    if (reservedProvidersNames.includes(providerName)) {
      throw new Error(`"${providerName}" is a reserved name for dependencies.`)
    }
  }
  function build<
    const ContextInput extends { [K in string]: unknown },
    const Context,
    const Errors extends functions.ErrorType,
  >(
    provider: Omit<ContextProvider<ContextInput, Context, Errors, Pv>, 'providers'>,
  ): ContextProvider<ContextInput, Context, Errors, Pv> {
    return { ...provider, providers }
  }
  return { build }
}

/**
 * A map of {@link provider.ContextProvider ContextProvider}s.
 */
export type Providers = {
  [K in string]: ContextProvider<any>
}

export type ProvidersToContext<Pv extends Providers> = {
  [K in keyof Pv]: Pv[K] extends ContextProvider<any, infer C, any> ? C : {}
} extends infer Context extends { [K in string]: unknown }
  ? Context
  : {}

export type ContextProvidersContextInput<Pv extends Providers> = UnionToIntersection<
  {
    [K in keyof Pv]: ContextProviderContextInput<Pv[K]>
  }[keyof Pv]
>

export type ContextProviderContextInput<P extends ContextProvider<any>> = (P extends ContextProvider<
  infer C extends { [K in string]: unknown },
  any,
  any
>
  ? 0 extends 1 & C
    ? {}
    : { [K in string]: unknown } extends C
      ? {}
      : C
  : {}) &
  ContextProvidersContextInput<P['providers']>
