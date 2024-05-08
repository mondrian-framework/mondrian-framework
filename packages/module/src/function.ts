import { guard, logger, provider, retrieve } from '.'
import { result, model, decoding } from '@mondrian-framework/model'
import { AtLeastOnePropertyOf } from '@mondrian-framework/utils'
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
 * Mondrian function.
 */
export interface Function<
  I extends model.Type = model.Type,
  O extends model.Type = model.Type,
  E extends ErrorType = undefined,
  C extends OutputRetrieveCapabilities = OutputRetrieveCapabilities,
  Pv extends provider.Providers = provider.Providers,
  G extends guard.Guards = guard.Guards,
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
   * Function guards.
   */
  readonly guards: G
  /**
   * Function {@link Middleware Middlewares}
   */
  readonly middlewares?: readonly Middleware<I, O, E, C, Pv, G>[]
}

/**
 * Opentelemetry Tracer extension where the span can also be undefined.
 */
export interface Tracer {
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
  Pv extends provider.Providers = provider.Providers,
  G extends guard.Guards = guard.Guards,
> extends Function<I, O, E, C, Pv, G> {
  /**
   * Function raw apply. This decodes the input and retrieve and calls the function's apply.
   */
  readonly rawApply: (args: FunctionRawApplyArguments<Pv, G>) => FunctionResult<O, E, C>
  /**
   * Function apply. This executes function's providers and function's body.
   */
  readonly apply: (args: FunctionApplyArguments<I, O, C, Pv, G>) => FunctionResult<O, E, C>
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
  /**
   * Overrides the default opentelemetry configuration in the module.
   */
  readonly opentelemetry?: boolean
}

export type GenericFunctionArguments = {
  readonly input: unknown
  readonly retrieve: retrieve.GenericRetrieve
  readonly logger: logger.MondrianLogger
  readonly tracer: Tracer
  readonly functionName: string
} & {
  [K in string]: unknown
}

/**
 * Arguments of a function invokation. The information coming from the providers are merged into the aruguments.
 */
export type FunctionArguments<
  I extends model.Type,
  O extends model.Type,
  C extends OutputRetrieveCapabilities,
  Pv extends provider.Providers,
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
  /**
   * Name that was assigned to the function by the module.
   */
  readonly functionName: string
} & provider.ProvidersToContext<Pv>

export type FunctionApplyArguments<
  I extends model.Type,
  O extends model.Type,
  C extends OutputRetrieveCapabilities,
  Pv extends provider.Providers,
  G extends guard.Guards,
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
  readonly contextInput: FunctionContextInput<Pv, G>
  /**
   * Function logger.
   */
  readonly logger: logger.MondrianLogger
}

export type FunctionRawApplyArguments<Pv extends provider.Providers, G extends guard.Guards> = {
  /**
   * Function's raw input. It respects the function input {@link model.Type Type}.
   */
  readonly rawInput: unknown
  /**
   * Function's raw retrieve. The return value must respects this retrieve object.
   */
  readonly rawRetrieve: unknown
  /**
   * Function context.
   */
  readonly contextInput: FunctionContextInput<Pv, G>
  /**
   * Function logger.
   */
  readonly logger: logger.MondrianLogger
  /**
   * The decogin options to use againts raw input and raw retrieve.
   */
  readonly decodingOptions?: decoding.Options
  /**
   * The decogin options to use againts retrieve, will override the decodingOptions.
   */
  readonly retrieveDecodingOptions?: decoding.Options
  /**
   * Types overrides for input and retrieve.
   */
  readonly overrides?: {
    readonly inputType?: model.Type
    readonly retrieveType?: model.Type
  }
  /**
   * Optional mappers for input and retrieve.
   */
  readonly mapper?: {
    input?: (input: unknown) => unknown
    retrieve?: (retr: retrieve.GenericRetrieve | undefined) => retrieve.GenericRetrieve | undefined
  }
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
  Pv extends provider.Providers,
  G extends guard.Guards,
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
    fn: FunctionImplementation<I, O, E, C, Pv, G>,
  ) => FunctionResult<O, E, C>
}

/**
 * A map of {@link Function}s.
 */
export type Functions<
  Fs extends Record<string, Function<any, any, any, any, any, any>> = Record<
    string,
    Function<any, any, any, any, any, any>
  >,
> = {
  [K in keyof Fs]: Fs[K]
}

/**
 * A map of {@link FunctionImplementation}s.
 */
export type FunctionImplementations<
  Fs extends Record<string, FunctionImplementation<any, any, any, any, any, any>> = Record<
    string,
    FunctionImplementation<any, any, any, any, any, any>
  >,
> = {
  [K in keyof Fs]: Fs[K]
}

/**
 * A map of {@link FunctionInterface}s.
 */
export type FunctionInterfaces = {
  [K in string]: FunctionInterface
}

type FunctionImplementor<
  I extends model.Type,
  O extends model.Type,
  E extends ErrorType,
  R extends OutputRetrieveCapabilities,
  Pv extends provider.Providers,
  G extends guard.Guards,
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
  implement: (implementation: Pick<Function<I, O, E, R, Pv, G>, 'body' | 'middlewares'>) => Function<I, O, E, R, Pv, G>
}

type FunctionMocker<
  I extends model.Type,
  O extends model.Type,
  E extends ErrorType,
  R extends OutputRetrieveCapabilities,
> = {
  /**
   * Instantiate a mocked {@link Function}.
   */
  mock(options?: MockOptions): Function<I, O, E, R, {}>
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
  use<const Pv extends provider.Providers, const G extends guard.Guards>(args: {
    providers?: Pv
    guards?: G
  }): FunctionImplementor<I, O, E, R, Pv, G>
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
  FunctionImplementor<I, O, E, R, {}, {}> &
  FunctionMocker<I, O, E, R> &
  FunctionProviderer<I, O, E, R> {
  const fi = {
    input: model.undefined() as I,
    output: model.undefined() as O,
    errors: undefined as E,
    retrieve: undefined as R,
    ...func,
  }
  function implement<Pv extends provider.Providers, G extends guard.Guards>({
    providers,
    guards,
  }: {
    providers?: Pv
    guards?: G
  }) {
    return (implementation: Pick<Function<I, O, E, R, Pv, G>, 'body' | 'middlewares'>) => {
      if (func.errors) {
        const undefinedError = Object.entries(func.errors).find(([_, errorType]) => model.isOptional(errorType))
        if (undefinedError) {
          throw new Error(`Function errors cannot be optional. Error "${undefinedError[0]}" is optional`)
        }
      }
      return {
        ...fi,
        providers: providers ?? ({} as Pv),
        guards: guards ?? ({} as G),
        ...implementation,
      }
    }
  }
  return {
    ...fi,
    mock: createMockedFunction(fi),
    implement: implement({}),
    use<const Pv extends provider.Providers = {}, const G extends guard.Guards = {}>(args: {
      providers?: Pv
      guards?: G
    }) {
      return { implement: implement(args) }
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
>(fi: FunctionInterface<I, O, E, R>): (options?: MockOptions) => Function<I, O, E, R, {}> {
  return (options) => {
    const outputType = model.concretise(fi.output)
    const errorProbability = options?.errorProbability ?? 0
    return {
      ...fi,
      providers: {},
      guards: {},
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
    }
  }
}

export type FunctionContextInput<
  Pv extends provider.Providers,
  G extends guard.Guards,
> = provider.ContextProvidersContextInput<Pv> & provider.ContextProvidersContextInput<G>

export type ErrorType = model.Types | undefined

export type OutputRetrieveCapabilities = retrieve.FunctionCapabilities | undefined

export type FunctionResult<O extends model.Type, E extends ErrorType, C extends OutputRetrieveCapabilities> = Promise<
  FunctionResultInternal<O, E, C>
>

/**
 * Turns output/error into a function's result:
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
