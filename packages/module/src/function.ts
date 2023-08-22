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
  input: I
  output: O
  apply: (args: FunctionArguments<I, O, Context>) => Promise<types.Infer<types.PartialDeep<O>>>
  before?: BeforeMiddleware<I, O, Context>[]
  after?: AfterMiddleware<I, O, Context>[]
  options?: { namespace?: string; description?: string }
}

/**
 * Arguments of a function call.
 */
export type FunctionArguments<I extends types.Type, O extends types.Type, Context extends Record<string, unknown>> = {
  input: types.Infer<I>
  projection: projection.FromType<O> | undefined
  operationId: string
  context: Context
  log: logger.Logger
}

/**
 * 'Before' function's middleware. Applied before calling the {@link Function}'s apply.
 * Usefull for trasforming the {@link FunctionArguments} of a function.
 */
export type BeforeMiddleware<I extends types.Type, O extends types.Type, Context extends Record<string, unknown>> = {
  name?: string
  apply: (args: {
    args: FunctionArguments<I, O, Context>
    thisFunction: Function<I, O, Context>
  }) => FunctionArguments<I, O, Context> | Promise<FunctionArguments<I, O, Context>>
}

/**
 * 'After' function's middleware. Applied after calling the {@link Function}'s apply.
 * Usefull for trasforming the {@link Function} apply result.
 */
export type AfterMiddleware<I extends types.Type, O extends types.Type, Context extends Record<string, unknown>> = {
  name?: string
  apply: (args: {
    args: FunctionArguments<I, O, Context>
    result: types.Infer<types.PartialDeep<O>>
    thisFunction: Function<I, O, Context>
  }) => types.Infer<types.PartialDeep<O>> | Promise<types.Infer<types.PartialDeep<O>>>
}

/**
 * A map of {@link Function}s.
 */
export type Functions<Contexts extends Record<string, Record<string, unknown>> = Record<string, any>> = {
  [K in keyof Contexts]: Function<types.Type, types.Type, Contexts[K]>
}

/**
 * Executes a Mondrian function with the given arguments. It's executes also the before and after middlewares.
 * @param func the function to execute.
 * @param args the function arguments.
 * @returns the function result.
 */
export async function apply<
  const I extends types.Type,
  const O extends types.Type,
  const Context extends Record<string, unknown>,
>(func: Function<I, O, Context>, args: FunctionArguments<I, O, Context>): Promise<types.Infer<types.PartialDeep<O>>> {
  for (const middleware of func.before ?? []) {
    args = await middleware.apply({ args, thisFunction: func })
  }
  let result = await func.apply(args)
  for (const middleware of func.after ?? []) {
    result = await middleware.apply({ args, result, thisFunction: func })
  }
  return result
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
