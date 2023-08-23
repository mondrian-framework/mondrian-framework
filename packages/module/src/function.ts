import { logger } from '.'
import { projection, types } from '@mondrian-framework/model'

/**
 * Mondrian function type.
 */
export type Function<
  I extends types.Type = types.Type,
  O extends types.Type = types.Type,
  Context extends Record<string, unknown> = Record<string, unknown>,
> = {
  readonly input: I
  readonly output: O
  readonly apply: (args: FunctionArguments<I, O, Context>) => Promise<types.Infer<types.PartialDeep<O>>>
  readonly middlewares?: readonly Middleware<I, O, Context>[]
  readonly options?: { readonly namespace?: string; readonly description?: string }
}

/**
 * Arguments of a function call.
 */
export type FunctionArguments<I extends types.Type, O extends types.Type, Context extends Record<string, unknown>> = {
  readonly input: types.Infer<I>
  readonly projection: projection.FromType<O> | undefined
  readonly operationId: string
  readonly context: Context
  readonly log: logger.Logger
}

/**
 * Mondrian function's middleware type. Applied before calling the {@link Function}'s apply.
 * Usefull for trasforming the {@link FunctionArguments} or the result of a function.
 * Example:
 * ```
 *
 * const hidePasswordMiddleware: Middleware<Input, Output, Context> = {
 *   name: 'Hide password',
 *   apply: async ({ next, args }) => {
 *     const result = await next(args)
 *     if (result?.password) {
 *       return { ...result, password: '****' }
 *     } else {
 *       return result
 *     }
 *   },
 * }
 * ```
 */
export type Middleware<I extends types.Type, O extends types.Type, Context extends Record<string, unknown>> = {
  name: string
  apply: (
    args: FunctionArguments<I, O, Context>,
    next: (args: FunctionArguments<I, O, Context>) => Promise<types.Infer<types.PartialDeep<O>>>,
    thisFunction: Function<I, O, Context>,
  ) => Promise<types.Infer<types.PartialDeep<O>>>
}

/**
 * A map of {@link Function}s.
 */
export type Functions<Contexts extends Record<string, Record<string, unknown>> = Record<string, any>> = {
  [K in keyof Contexts]: Function<types.Type, types.Type, Contexts[K]>
}

/**
 * Builds a Mondrian function.
 *
 * Example:
 * ```typescript
 * import { types } from '@mondrian-framework/model'
 * import { functions } from '@mondrian-framework/module'
 *
 * const loginFunction = functions
 *   .build({
 *     input: type.object({ username: types.stirng(), password: types.string() }),
 *     output: types.string(),
 *     body: async ({ input: { username, password } }) => {
 *       return 'something'
 *     }
 *   })
 * ```
 */
export function build<const I extends types.Type, const O extends types.Type>(
  func: Function<I, O, {}>,
): Function<I, O, {}> {
  return withContext().build(func)
}

/**
 * Builds a Mondrian function with a given Context type.
 *
 * Example:
 * ```typescript
 * import { types } from '@mondrian-framework/model'
 * import { functions } from '@mondrian-framework/module'
 *
 * const loginFunction = functions
 *   .withContext<{ db: Db }>()
 *   .build({
 *     input: type.object({ username: types.stirng(), password: types.string() }),
 *     output: types.string(),
 *     body: async ({ input: { username, password }, context: { db } }) => {
 *       return 'something'
 *     }
 *   })
 * ```
 */
export function withContext<const Context extends Record<string, unknown>>(): FunctionBuilder<Context> {
  return new FunctionBuilder()
}

/**
 * Mondrian function builder.
 */
class FunctionBuilder<const Context extends Record<string, unknown>> {
  constructor() {}
  /**
   * Builds a Mondrian function.
   * @returns A Mondrian function.
   */
  public build<const I extends types.Type, const O extends types.Type>(
    func: Function<I, O, Context>,
  ): Function<I, O, Context> {
    return func
  }
} 
