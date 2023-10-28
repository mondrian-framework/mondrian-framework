import { logger } from '.'
import { BaseFunction } from './function/base'
import { result, retrieve, types } from '@mondrian-framework/model'

/**
 * Mondrian function interface.
 */
export interface FunctionInterface<
  I extends types.Type = types.Type,
  O extends types.Type = types.Type,
  E extends ErrorType = ErrorType,
  R extends OutputRetrieveCapabilities = OutputRetrieveCapabilities,
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
  readonly errors: E
  /**
   * The type describing the possible errors returned by the function.
   */
  readonly retrieve: R
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
  C extends OutputRetrieveCapabilities = OutputRetrieveCapabilities,
  Context extends Record<string, unknown> = Record<string, unknown>,
> extends FunctionInterface<I, O, E, C> {
  /**
   * Function body.
   */
  readonly body: (args: FunctionArguments<I, O, C, Context>) => FunctionResult<O, E, C>
  /**
   * Function {@link Middleware Middlewares}
   */
  readonly middlewares?: readonly Middleware<I, O, E, C, Context>[]
}

/**
 * Mondrian function implemetation.
 */
export interface FunctionImplementation<
  I extends types.Type = types.Type,
  O extends types.Type = types.Type,
  E extends ErrorType = ErrorType,
  C extends OutputRetrieveCapabilities = OutputRetrieveCapabilities,
  Context extends Record<string, unknown> = Record<string, unknown>,
> extends Function<I, O, E, C, Context> {
  /**
   * Function apply. This executes function's {@link Middleware} and function's body.
   */
  readonly apply: (args: FunctionArguments<I, O, C, Context>) => FunctionResult<O, E, C>
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
export type FunctionArguments<
  I extends types.Type,
  O extends types.Type,
  R extends OutputRetrieveCapabilities,
  Context extends Record<string, unknown>,
> = {
  /**
   * Function's input. It respects the function input {@link types.Type Type}.
   */
  readonly input: types.Infer<I>
  /**
   * Wanted retrieve. The return value must respects this retrieve object.
   */
  readonly retrieve: retrieve.FromType<O, R> | undefined
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

export type ErrorType = types.Types | undefined

export type OutputRetrieveCapabilities = retrieve.Capabilities | undefined

export type FunctionResult<O extends types.Type, E extends ErrorType, C extends OutputRetrieveCapabilities> = Promise<
  FunctionResultInternal<O, E, C>
>

/**
 * Turns input/output/error into a function's result:
 * - if the error is undefined then the function is assumed to never fail and just returns the
 *   partial version of the inferred value
 * - if the error is a union then the function will return a `Result` that can fail with the given error
 */
//prettier-ignore
type FunctionResultInternal<O extends types.Type, E extends ErrorType, C extends OutputRetrieveCapabilities> 
  = [C] extends [{ select: true }] ?
      [E] extends [types.Types] ? result.Result<types.Infer<types.PartialDeep<O>>, InferErrorType<E>>
    : [E] extends [undefined] ? types.Infer<types.PartialDeep<O>>
    : any
  :   [E] extends [types.Types] ? result.Result<types.Infer<O>, InferErrorType<E>>
    : [E] extends [undefined] ? types.Infer<O>
    : any

type InferErrorType<Ts extends types.Types> = { [K in keyof Ts]: { [K2 in K]: types.Infer<Ts[K]> } }[keyof Ts]

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
  C extends OutputRetrieveCapabilities,
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
    args: FunctionArguments<I, O, C, Context>,
    next: (args: FunctionArguments<I, O, C, Context>) => FunctionResult<O, E, C>,
    thisFunction: FunctionImplementation<I, O, E, C, Context>,
  ) => FunctionResult<O, E, C>
}

/**
 * A map of {@link FunctionImplementation}s.
 */
export type Functions<Contexts extends Record<string, Record<string, unknown>> = Record<string, any>> = {
  [K in keyof Contexts]: FunctionImplementation<types.Type, types.Type, any, OutputRetrieveCapabilities, Contexts[K]>
}

/**
 * A map of {@link FunctionInterface}s.
 */
export type FunctionsInterfaces = {
  [K in string]: FunctionInterface
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
export function build<
  const I extends types.Type,
  const O extends types.Type,
  const E extends ErrorType,
  const C extends OutputRetrieveCapabilities,
>(func: Function<I, O, E, C, {}>): FunctionImplementation<I, O, E, C, {}> {
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
  public build<
    const I extends types.Type,
    const O extends types.Type,
    const E extends ErrorType,
    const R extends OutputRetrieveCapabilities,
  >(func: Function<I, O, E, R, Context>): FunctionImplementation<I, O, E, R, Context> {
    return new BaseFunction(func)
  }
}

/**
 * Build only the signature of a {@link Function} i.e. a {@link FunctionInterface}.
 * @param func input, output, and possible errors of the function signature
 * @returns the function interface
 */
export function define<
  const I extends types.Type,
  const O extends types.Type,
  const E extends ErrorType,
  R extends OutputRetrieveCapabilities,
>(func: FunctionInterface<I, O, E, R>): FunctionInterface<I, O, E, R> {
  return func
}
