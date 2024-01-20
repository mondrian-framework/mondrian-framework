import { functions, logger, provider, retrieve, utils } from '.'
import { BaseFunction } from './function/base'
import { result, model } from '@mondrian-framework/model'
import { AtLeastOnePropertyOf, UnionToIntersection } from '@mondrian-framework/utils'
import { Span, SpanOptions } from '@opentelemetry/api'
import { randomInt } from 'crypto'

/**
 * Mondrian function interface.
 */
export interface FunctionInterface<
  I extends model.Type = model.Type,
  O extends model.Type = model.Type,
  E extends ErrorType = ErrorType,
  C extends OutputRetrieveCapabilities = OutputRetrieveCapabilities,
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
  readonly errors: E
  /**
   * The type describing the possible errors returned by the function.
   */
  readonly retrieve: C
  /**
   * Function {@link FunctionOptions}
   */
  readonly options?: FunctionOptions
}

/**
 * A map of {@link provider.ContextProvider ContextProvider}s.
 */
export type Providers = Record<string, provider.ContextProvider<any, unknown, ErrorType>>

/**
 * Mondrian function.
 */
export interface Function<
  I extends model.Type = model.Type,
  O extends model.Type = model.Type,
  E extends ErrorType = undefined,
  C extends OutputRetrieveCapabilities = OutputRetrieveCapabilities,
  Pv extends Providers = Providers,
> extends FunctionInterface<I, O, E, C> {
  /**
   * Function body.
   */
  readonly body: (args: FunctionArguments<I, O, C, Pv>) => FunctionResult<O, E, C>
  /**
   * Function providers.
   */
  readonly providers: Pv
  /**
   * Function {@link Middleware Middlewares}
   */
  readonly middlewares?: readonly Middleware<I, O, E, C, Pv>[]
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
  Pv extends Providers = Providers,
> extends Function<I, O, E, C, Pv> {
  /**
   * Function apply. This executes function's {@link Middleware} and function's body.
   */
  readonly apply: (args: FunctionApplyArguments<I, O, C, Pv>) => FunctionResult<O, E, C>
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
 * Arguments of a function invokation. The information coming from the providers are merged into the aruguments.
 */
export type FunctionArguments<
  I extends model.Type,
  O extends model.Type,
  C extends OutputRetrieveCapabilities,
  Pv extends Providers,
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
   * Function logger.
   */
  readonly logger: logger.MondrianLogger
  /**
   * Openteletry {@link Tracer} of this function.
   */
  readonly tracer: Tracer
} & ProvidersToContext<Pv>

export type FunctionApplyArguments<
  I extends model.Type,
  O extends model.Type,
  C extends OutputRetrieveCapabilities,
  Pv extends Providers,
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
  readonly contextInput: ProvidersToContextInput<Pv>
  /**
   * Function logger.
   */
  readonly logger: logger.MondrianLogger
  /**
   * Openteletry {@link Tracer} of this function.
   */
  readonly tracer: Tracer
}

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
  Pv extends Providers,
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
    args: FunctionArguments<I, O, C, Pv>,
    next: (args: FunctionArguments<I, O, C, Pv>) => FunctionResult<O, E, C>,
    fn: FunctionImplementation<I, O, E, C, Pv>,
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

type FunctionImplementor<
  I extends model.Type,
  O extends model.Type,
  E extends ErrorType,
  R extends OutputRetrieveCapabilities,
  Pv extends Providers,
> = {
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
  implement: (
    implementation: Pick<Function<I, O, E, R, Pv>, 'body' | 'middlewares'>,
  ) => FunctionImplementation<I, O, E, R, Pv>
}

type FunctionMocker<
  I extends model.Type,
  O extends model.Type,
  E extends ErrorType,
  R extends OutputRetrieveCapabilities,
> = {
  /**
   * Instantiate a mocked {@link FunctionImplementation}.
   */
  mock(options?: MockOptions): FunctionImplementation<I, O, E, R, {}>
}

type FunctionProviderer<
  I extends model.Type,
  O extends model.Type,
  E extends ErrorType,
  R extends OutputRetrieveCapabilities,
> = {
  //TODO: how to limit providers errors to be a subset of function interface errors?
  /**
   * Binds some {@link provider.ContextProvider ContextProvider}s to the function.
   */
  withProviders<const Pv extends Providers>(providers: Pv): FunctionImplementor<I, O, E, R, Pv>
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
): FunctionInterface<I, O, E, R> &
  FunctionImplementor<I, O, E, R, {}> &
  FunctionMocker<I, O, E, R> &
  FunctionProviderer<I, O, E, R> {
  const fi = {
    input: model.undefined() as I,
    output: model.undefined() as O,
    errors: undefined as E,
    retrieve: undefined as R,
    ...func,
  }
  function implement<Pv extends Providers>(providers: Pv) {
    return (implementation: Pick<Function<I, O, E, R, Pv>, 'body' | 'middlewares'>) => {
      if (func.errors) {
        const undefinedError = Object.entries(func.errors).find(([_, errorType]) => model.isOptional(errorType))
        if (undefinedError) {
          throw new Error(`Function errors cannot be optional. Error "${undefinedError[0]}" is optional`)
        }
      }
      return new BaseFunction<I, O, E, R, Pv>({ ...fi, providers, ...implementation })
    }
  }
  return {
    ...fi,
    mock: createMockedFunction(fi),
    implement: implement({}),
    withProviders<const Pv extends Providers>(providers: Pv) {
      return { implement: implement(providers) }
    },
  }
}

type MockOptions = {
  /**
   * Express the probability of the function to return an error.
   */
  errorProbability?: number
  /**
   * Express how deep the example should be generated. Default is 1.
   * With a value greater than 3 the perfomance could become an issue if you data-graph contains many arrays.
   */
  maxDepth?: number
}

function createMockedFunction<
  const I extends model.Type = model.LiteralType<undefined>,
  const O extends model.Type = model.LiteralType<undefined>,
  const E extends ErrorType = undefined,
  R extends OutputRetrieveCapabilities = undefined,
>(
  fi: functions.FunctionInterface<I, O, E, R>,
): (options?: MockOptions) => functions.FunctionImplementation<I, O, E, R, {}> {
  return (options) => {
    const outputType = model.concretise(fi.output)
    const errorProbability = options?.errorProbability ?? 0
    return new BaseFunction<I, O, E, R, {}>({
      ...fi,
      providers: {},
      async body() {
        if (fi.errors && errorProbability > Math.random()) {
          const errors = Object.entries(fi.errors)
          const selected = randomInt(0, errors.length)
          const errorKey = errors[selected][0]
          const errorValue = model.concretise(errors[selected][1]).example({ maxDepth: options?.maxDepth })
          return result.fail({ [errorKey]: errorValue })
        }
        //TODO: we could improve this generation by following selection inside retrieve
        const value = outputType.example({ maxDepth: options?.maxDepth })
        return result.ok(value) as any
      },
    })
  }
}

export type ProvidersToContext<Pv extends Providers> = {
  [K in keyof Pv]: Pv[K] extends provider.ContextProvider<any, infer C, any> ? C : {}
} extends infer Context extends Record<string, unknown>
  ? Context
  : {}

export type ProvidersToContextInput<Pv extends functions.Providers> = UnionToIntersection<
  { [K in keyof Pv]: Pv[K] extends provider.ContextProvider<infer C, any, any> ? C : {} }[keyof Pv]
> extends infer ContextInput extends Record<string, unknown>
  ? ContextInput
  : {}

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
