import { logger } from '.'
import { BaseFunction } from './function/base'
import { projection, result, types } from '@mondrian-framework/model'

/**
 * Mondrian function interface.
 */
export interface FunctionInterface<
  I extends types.Type = types.Type,
  O extends types.Type = types.Type,
  E extends ErrorType = undefined,
> {
  /**
   * Function input {@link types.Type Type}.
   */
  readonly input: I
  /**
   * Function output {@link types.Type Type}.
   */
  readonly output: O
  /**
   * The type describing the possible errors returned by the function.
   */
  readonly error: E
  /**
   * Function {@link FunctionOptions}
   */
  readonly options?: FunctionOptions
}

/**
 * Mondrian function.
 */
export interface Function<
  I extends types.Type = types.Type,
  O extends types.Type = types.Type,
  E extends ErrorType = undefined,
  Context extends Record<string, unknown> = Record<string, unknown>,
> extends FunctionInterface<I, O, E> {
  /**
   * Function body.
   */
  readonly body: (args: FunctionArguments<I, O, Context>) => FunctionResult<O, E>
  /**
   * Function {@link Middleware Middlewares}
   */
  readonly middlewares?: readonly Middleware<I, O, E, Context>[]
}

/**
 * Mondrian function implemetation.
 */
export interface FunctionImplementation<
  I extends types.Type = types.Type,
  O extends types.Type = types.Type,
  E extends ErrorType = undefined,
  Context extends Record<string, unknown> = Record<string, unknown>,
> extends Function<I, O, E, Context> {
  /**
   * Function apply. This executes function's {@link Middleware} and function's body.
   */
  readonly apply: (args: FunctionArguments<I, O, Context>) => FunctionResult<O, E>
}

/**
 * Mondrian {@link Function} options.
 */
export type FunctionOptions = {
  /**
   * Namespace of a function. It's used as documentation.
   */
  readonly namespace?: string
  /**
   * Description of a function.  It's used as documentation.
   */
  readonly description?: string
}

/**
 * Arguments of a function invokation.
 */
export type FunctionArguments<I extends types.Type, O extends types.Type, Context extends Record<string, unknown>> = {
  /**
   * Function's input. It respects the function input {@link types.Type Type}.
   */
  readonly input: types.Infer<I>
  /**
   * Wanted output projection. The return value must respects this projection.
   */
  readonly projection: projection.FromType<O> | undefined
  /**
   * Operation ID.
   */
  readonly operationId: string
  /**
   * Function context.
   */
  readonly context: Context
  /**
   * Function logger.
   */
  readonly logger: logger.MondrianLogger
}

export type ErrorType = types.UnionType<any> | undefined

export type FunctionResult<O extends types.Type, E extends ErrorType> = Promise<FunctionResultInternal<O, E>>

type A = FunctionResult<types.Type, ErrorType>

type FunctionResultInternal<O extends types.Type, E extends ErrorType> = [E] extends [types.UnionType<infer _>]
  ? result.Result<types.Infer<types.PartialDeep<O>>, types.Infer<E>>
  : [E] extends [undefined]
  ? types.Infer<types.PartialDeep<O>>
  : never

/**
 * Mondrian function's middleware type. Applied before calling the {@link Function}'s body.
 * Usefull for trasforming the {@link FunctionArguments} or the result of a function.
 * Example:
 * ```
 *
 * const hidePasswordMiddleware: Middleware<Input, Output, Context> = {
 *   name: 'Hide password',
 *   apply: async ({ next, args }) => {
 *     const result = await next(args)
 *     return result?.password ? { ...result, password: '****' } : result
 *   },
 * }
 * ```
 */
export type Middleware<
  I extends types.Type,
  O extends types.Type,
  E extends ErrorType,
  Context extends Record<string, unknown>,
> = {
  /**
   * Middleware descriptive name.
   */
  name: string
  /**
   * Apply function of this middleware.
   * @param args Argument of the functin invokation. Can be transformed with `next` callback.
   * @param next Continuation callback of the middleware.
   * @param thisFunction Reference to the underlying {@link FunctionImplementation}.
   * @returns a value that respect function's output type and the given projection.
   */
  apply: (
    args: FunctionArguments<I, O, Context>,
    next: (args: FunctionArguments<I, O, Context>) => FunctionResult<O, E>,
    thisFunction: FunctionImplementation<I, O, E, Context>,
  ) => FunctionResult<O, E>
}

/**
 * A map of {@link FunctionImplementation}s.
 */
export type Functions<Contexts extends Record<string, Record<string, unknown>> = Record<string, any>> = {
  [K in keyof Contexts]: FunctionImplementation<types.Type, types.Type, ErrorType, Contexts[K]>
}

/**
 * A map of {@link FunctionInterface}s.
 */
export type FunctionsInterfaces = {
  [K in string]: FunctionInterface<types.Type, types.Type, ErrorType>
}

/**
 * Builds a Mondrian function.
 *
 * Example:
 * ```typescript
 * import { types } from '@mondrian-framework/model'
 * import { functions } from '@mondrian-framework/module'
 *
 * const loginFunction = functions.build({
 *   input: type.object({ username: types.stirng(), password: types.string() }),
 *   output: types.string(),
 *   body: async ({ input: { username, password }, context: { db } }) => {
 *     const user = await db.findUser({ username })
 *     // ...
 *     return 'signed jwt'
 *   },
 *   middlewares: [hidePasswordMiddleware],
 *   options: {
 *     namespace: 'authentication',
 *     description: 'Sign a jwt for the authenticated user (1h validity)'
 *   }
 * })
 * ```
 */
export function build<const I extends types.Type, const O extends types.Type, const E extends ErrorType>(
  func: Function<I, O, E, {}>,
): FunctionImplementation<I, O, E, {}> {
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
  public build<const I extends types.Type, const O extends types.Type, const E extends ErrorType = undefined>(
    func: Function<I, O, E, Context>,
  ): FunctionImplementation<I, O, E, Context> {
    return new BaseFunction(func)
  }
}

/**
 * Build only the signature of a {@link Function} i.e. a {@link FunctionInterface}.
 * @param func input, output, and possible errors of the function signature
 * @returns the function interface
 */
export function define<const I extends types.Type, const O extends types.Type, const E extends ErrorType>(
  func: FunctionInterface<I, O, E>,
): FunctionInterface<I, O, E> {
  return func
}
