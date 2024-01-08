import { logger, retrieve } from '.'
import { BaseFunction } from './function/base'
import { result, model } from '@mondrian-framework/model'
import { Span, SpanOptions } from '@opentelemetry/api'

/**
 * Mondrian function interface.
 */
export interface FunctionInterface<
  I extends model.Type = model.Type,
  O extends model.Type = model.Type,
  E extends ErrorType = ErrorType,
  R extends OutputRetrieveCapabilities = OutputRetrieveCapabilities,
> {
  /**
   * Function input {@link model.Type Type}.
   */
  readonly input: I
  /**
   * Function output {@link model.Type Type}.
   */
  readonly output: O
  /**
   * The type describing the possible errors returned by the function.
   */
  readonly errors?: E
  /**
   * The type describing the possible errors returned by the function.
   */
  readonly retrieve?: R
  /**
   * Function {@link FunctionOptions}
   */
  readonly options?: FunctionOptions
}

/**
 * Mondrian function.
 */
export interface Function<
  I extends model.Type = model.Type,
  O extends model.Type = model.Type,
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
 * Opentelemetry Tracer extension where the span can also be undefined.
 */
export interface Tracer {
  /**
   * Sets a prefix value for the name parameter for all the `startActiveSpan` calls.
   */
  withPrefix(name: string): Tracer
  startActiveSpan<F extends (span?: Span) => unknown>(name: string, fn: F): ReturnType<F>
  startActiveSpanWithOptions<F extends (span?: Span) => unknown>(
    name: string,
    options: SpanOptions,
    fn: F,
  ): ReturnType<F>
}

/**
 * Mondrian function implemetation.
 */
export interface FunctionImplementation<
  I extends model.Type = model.Type,
  O extends model.Type = model.Type,
  E extends ErrorType = ErrorType,
  C extends OutputRetrieveCapabilities = OutputRetrieveCapabilities,
  Context extends Record<string, unknown> = Record<string, unknown>,
> extends Function<I, O, E, C, Context> {
  /**
   * Function apply. This executes function's {@link Middleware} and function's body.
   */
  readonly apply: (args: FunctionArguments<I, O, C, Context>) => FunctionResult<O, E, C>
  /**
   * Openteletry {@link Tracer} of this function.
   */
  readonly tracer: Tracer
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
   * Description of a function. It's used as documentation.
   */
  readonly description?: string
  /**
   * Describes the function semantc: query or command
   */
  readonly operation?: 'query' | 'command' | { readonly command: 'create' | 'update' | 'delete' }
}

/**
 * Arguments of a function invokation.
 */
export type FunctionArguments<
  I extends model.Type,
  O extends model.Type,
  C extends OutputRetrieveCapabilities,
  Context extends Record<string, unknown>,
> = {
  /**
   * Function's input. It respects the function input {@link model.Type Type}.
   */
  readonly input: model.Infer<I>
  /**
   * Wanted retrieve. The return value must respects this retrieve object.
   */
  readonly retrieve: retrieve.FromType<O, C>
  /**
   * Function context.
   */
  readonly context: Context
  /**
   * Function logger.
   */
  readonly logger: logger.MondrianLogger
  /**
   * Openteletry {@link Tracer} of this function.
   */
  readonly tracer: Tracer
}

export type ErrorType = model.Types | undefined

export type OutputRetrieveCapabilities = retrieve.Capabilities | undefined

export type FunctionResult<O extends model.Type, E extends ErrorType, C extends OutputRetrieveCapabilities> = Promise<
  FunctionResultInternal<O, E, C>
>

/**
 * Turns input/output/error into a function's result:
 * - if the error is undefined then the function is assumed to never fail and just returns the
 *   partial version of the inferred value
 * - if the error is a union then the function will return a `Result` that can fail with the given error
 */
//prettier-ignore
type FunctionResultInternal<O extends model.Type, E extends ErrorType, C extends OutputRetrieveCapabilities> 
  = [C] extends [{ select: true }] ?
      [Exclude<E, undefined>] extends [infer E1 extends model.Types] ? result.Result<model.Infer<model.PartialDeep<O>>, InferErrorType<E1>>
    : [E] extends [undefined] ? result.Result<model.Infer<model.PartialDeep<O>>, never>
    : result.Result<never, Record<string, unknown>>
  :   [Exclude<E, undefined>] extends [infer E1 extends model.Types] ? result.Result<model.Infer<O>, InferErrorType<E1>>
    : [E] extends [undefined] ? result.Result<model.Infer<O>, never>
    : result.Result<never, Record<string, unknown>>

export type InferErrorType<Ts extends model.Types> = 0 extends 1 & Ts
  ? never
  : AtLeastOnePropertyOf<{ [K in keyof Ts]: model.Infer<Ts[K]> }>

type AtLeastOnePropertyOf<T> = { [K in keyof T]: { [L in K]: T[L] } & { [L in Exclude<keyof T, K>]?: T[L] } }[keyof T]

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
  I extends model.Type,
  O extends model.Type,
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
   * @param fn Reference to the underlying {@link FunctionImplementation}.
   * @returns a value that respect function's output type and the given projection.
   */
  apply: (
    args: FunctionArguments<I, O, C, Context>,
    next: (args: FunctionArguments<I, O, C, Context>) => FunctionResult<O, E, C>,
    fn: FunctionImplementation<I, O, E, C, Context>,
  ) => FunctionResult<O, E, C>
}

/**
 * A map of {@link FunctionImplementation}s.
 */
export type Functions<
  Fs extends Record<string, FunctionImplementation<any, any, any, any, any>> = Record<
    string,
    FunctionImplementation<any, any, any, any, any>
  >,
> = {
  [K in keyof Fs]: Fs[K]
}

/**
 * A map of {@link FunctionInterface}s.
 */
export type FunctionsInterfaces = {
  [K in string]: FunctionInterface
}

/**
 * Defines the signature of a {@link Function} i.e. a {@link FunctionInterface}.
 * @param func input, output, and possible errors of the function signature
 * @returns the function interface with an utility method in order to implement the function (`implement`)
 *
 * Example:
 * ```typescript
 * import { model } from '@mondrian-framework/model'
 * import { functions } from '@mondrian-framework/module'
 *
 * const loginFunction = functions.define({
 *   input: type.object({ username: model.stirng(), password: model.string() }),
 *   output: model.string(),
 * })
 * ```
 */
export function define<
  const I extends model.Type = model.LiteralType<undefined>,
  const O extends model.Type = model.LiteralType<undefined>,
  const E extends ErrorType = undefined,
  R extends OutputRetrieveCapabilities = undefined,
>(
  func: Partial<FunctionInterface<I, O, E, R>>,
): FunctionInterface<I, O, E, R> & {
  /**
   * Implements the function definition by defining the body of the function
   * @param implementation the body, and optionally the middlewares of the function.
   * @returns the function implementation
   * * Example:
   * ```typescript
   * import { model } from '@mondrian-framework/model'
   * import { functions } from '@mondrian-framework/module'
   *
   * const loginFunction = functions.define({
   *   input: type.object({ username: model.stirng(), password: model.string() }),
   *   output: model.string(),
   * }).implement({
   *   body: async ({ input: { username, password }, context: { db } }) => {
   *     return 'something'
   *   }
   * })
   * ```
   */
  implement: <const Context extends Record<string, unknown> = {}>(
    implementation: Pick<Function<I, O, E, R, Context>, 'body' | 'middlewares'>,
  ) => FunctionImplementation<I, O, E, R, Context>
} {
  const fi = {
    input: model.undefined() as I,
    output: model.undefined() as O,
    ...func,
  }
  return {
    ...fi,
    implement<const Context extends Record<string, unknown> = {}>(
      implementation: Pick<Function<I, O, E, R, Context>, 'body' | 'middlewares'>,
    ) {
      if (func.errors) {
        const undefinedError = Object.entries(func.errors).find(([_, errorType]) => model.isOptional(errorType))
        if (undefinedError) {
          throw new Error(`Function errors cannot be optional. Error "${undefinedError[0]}" is optional`)
        }
      }
      return new BaseFunction<I, O, E, R, Context>({ ...fi, ...implementation })
    },
  }
}
