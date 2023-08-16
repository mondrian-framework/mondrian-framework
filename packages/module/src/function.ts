import { Logger } from './log'
import { projection, types } from '@mondrian-framework/model'

/**
 * Mondrian function type.
 */
export type Function<I extends types.Type, O extends types.Type, Context extends Record<string, unknown>> = {
  input: I
  output: O
  apply: (args: FunctionArguments<I, O, Context>) => Promise<types.InferPartial<O>>
  before?: BeforeMiddleware<I, O, Context>[]
  after?: AfterMiddleware<I, O, Context>[]
  options?: { namespace?: string; description?: string }
}

export async function call<
  const I extends types.Type,
  const O extends types.Type,
  const Context extends Record<string, unknown>,
>(func: Function<I, O, Context>, args: FunctionArguments<I, O, Context>): Promise<types.InferPartial<O>> {
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
 * Arguments of a function call.
 */
export type FunctionArguments<I extends types.Type, O extends types.Type, Context> = {
  input: types.Infer<I>
  projection: projection.FromType<O> | undefined
  operationId: string
  context: Context
  log: Logger
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
    result: types.InferPartial<O>
    thisFunction: Function<I, O, Context>
  }) => types.InferPartial<O> | Promise<types.InferPartial<O>>
}

/**
 * A map of {@link Function}s.
 */
export type Functions<Contexts extends Record<string, Record<string, unknown>> = Record<string, any>> = {
  [K in keyof Contexts]: Function<types.Type, types.Type, Contexts[K]>
}

/**
 * Function builder.
 */
class FunctionBuilder<const Context extends Record<string, unknown>> {
  constructor() {}

  /**
   * Assigns the Context type of the function that are being building.
   * @returns
   */
  public withContext<const Context extends Record<string, unknown>>(): FunctionBuilder<Context> {
    return new FunctionBuilder()
  }

  /**
   * Builds a Mondrian function.
   * @returns A Mondrian function with the applied middlewares.
   */
  public build<const I extends types.Type, const O extends types.Type>(
    func: Function<I, O, Context>,
  ): Function<I, O, Context> {
    return func
  }
}

/**
 * The function builder singleton. It's used to build any Mondrian function.
 *
 * Example:
 * ```typescript
 * import { types } from '@mondrian-framework/model'
 * import { func } from '@mondrian-framework/module'
 *
 * const loginFunction = func
 *   .build({
 *     input: type.object({ username: types.stirng(), password: types.string() }),
 *     output: types.string(),
 *     body: async ({ input: { username, password } }) => {
 *       return 'TODO'
 *     }
 *   })
 * ```
 */
export const builder: FunctionBuilder<{}> = new FunctionBuilder()
