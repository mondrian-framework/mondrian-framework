import { error, exception, functions, guard, provider, retrieve } from '..'
import { TracerWrapper, voidTracer } from './tracer'
import { model, result } from '@mondrian-framework/model'
import { SpanKind, SpanStatusCode, Counter, Histogram, Tracer, Span } from '@opentelemetry/api'

/**
 * Basic function implementation.
 */
export class BaseFunction<
  I extends model.Type,
  O extends model.Type,
  E extends functions.ErrorType,
  C extends functions.OutputRetrieveCapabilities,
  Pv extends provider.Providers,
  G extends guard.Guards,
> implements functions.FunctionImplementation<I, O, E, C, Pv, G>
{
  readonly input: I
  readonly output: O
  readonly errors: E
  readonly retrieve: C
  readonly providers: Pv
  readonly guards: G
  readonly body: (args: functions.FunctionArguments<I, O, C, Pv>) => functions.FunctionResult<O, E, C>
  readonly middlewares: readonly functions.Middleware<I, O, E, C, Pv, G>[]
  readonly options: { readonly namespace?: string | undefined; readonly description?: string | undefined } | undefined
  readonly tracer: functions.Tracer
  readonly name: string
  readonly retrieveType: model.Type | undefined
  readonly badInputErrorKey: string | undefined

  constructor(func: functions.Function<I, O, E, C, Pv, G>, name?: string) {
    this.input = func.input
    this.output = func.output
    this.errors = func.errors
    this.retrieve = func.retrieve
    this.providers = func.providers
    this.guards = func.guards
    this.body = func.body
    this.middlewares = func.middlewares ?? []
    this.options = func.options
    this.tracer = voidTracer
    this.name = name ?? ''
    this.retrieveType = retrieve.fromType(this.output, this.retrieve).match(
      (t) => t,
      () => undefined,
    )
    this.badInputErrorKey = Object.entries(this.errors ?? {}).find((v) => v[1] === error.standard.BadInput)?.[0]
  }

  public async rawApply({
    rawInput,
    rawRetrieve,
    decodingOptions,
    overrides,
    mapper,
    ...args
  }: functions.FunctionRawApplyArguments<Pv, G>): functions.FunctionResult<O, E, C> {
    //decode input
    const decodedInput = model.concretise(overrides?.inputType ?? this.input).decode(rawInput, decodingOptions)
    if (decodedInput.isFailure) {
      if (this.badInputErrorKey !== undefined) {
        const e: model.Infer<(typeof error)['standard']['BadInput']> = {
          message: 'Bad input.',
          from: 'input',
          errors: decodedInput.error,
        }
        return result.fail({ [this.badInputErrorKey]: e }) as Awaited<functions.FunctionResult<O, E, C>>
      } else {
        throw new exception.InvalidInput('input', decodedInput.error)
      }
    }

    //decode retrieve
    const decodedRetrieve = this.retrieveType
      ? model.concretise(overrides?.retrieveType ?? this.retrieveType).decode(rawRetrieve, decodingOptions)
      : result.ok()
    if (decodedRetrieve.isFailure) {
      if (this.badInputErrorKey !== undefined) {
        const e: model.Infer<(typeof error)['standard']['BadInput']> = {
          message: 'Bad input.',
          from: 'retrieve',
          errors: decodedRetrieve.error,
        }
        return result.fail({ [this.badInputErrorKey]: e }) as Awaited<functions.FunctionResult<O, E, C>>
      } else {
        throw new exception.InvalidInput('retrieve', decodedRetrieve.error)
      }
    }
    //apply mappers
    const mappedInput = mapper?.input ? mapper.input(decodedInput.value) : decodedInput.value
    const mappedRetrieve = mapper?.retrieve ? mapper.retrieve(decodedRetrieve.value) : decodedRetrieve.value
    const applyArgs = { ...args, input: mappedInput, retrieve: mappedRetrieve }

    //run function apply
    return this.apply(applyArgs)
  }

  private async runProvider(
    provider: provider.ContextProvider,
    contextInput: any,
    args: functions.GenericFunctionArguments,
    cache: Map<unknown, result.Result<unknown, unknown>>,
  ): Promise<result.Result<unknown, unknown>> {
    const cached = cache.get(provider)
    if (cached) {
      return cached
    }
    const provided: { [K in string]: unknown } = {}
    for (const [name, pv] of Object.entries(provider.providers)) {
      const res = await this.runProvider(pv, contextInput, args, cache)
      if (res.isFailure) {
        return res
      }
      provided[name] = res.value
    }
    const res = await provider.body(contextInput, { ...args, ...provided })
    cache.set(provider, res)
    return res
  }

  protected async applyProviders(
    args: functions.FunctionApplyArguments<I, O, C, Pv, G>,
  ): Promise<result.Result<functions.FunctionArguments<I, O, C, Pv>, unknown>> {
    const mappedArgs: functions.GenericFunctionArguments = {
      input: args.input,
      retrieve: args.retrieve as retrieve.GenericRetrieve,
      logger: args.logger,
      tracer: args.tracer ?? this.tracer,
      functionName: this.name,
    }
    const cache = new Map<unknown, result.Result<unknown, unknown>>()
    //Apply guards
    for (const guard of Object.values(this.guards)) {
      const res = await this.runProvider(guard, args.contextInput, mappedArgs, cache)
      if (res && res.isFailure) {
        return res
      }
    }
    //Apply providers
    for (const [providerName, provider] of Object.entries(this.providers)) {
      const res = await this.runProvider(provider, args.contextInput, mappedArgs, cache)
      if (res.isFailure) {
        return res
      }
      mappedArgs[providerName] = res.value
    }
    return result.ok(mappedArgs as functions.FunctionArguments<I, O, C, Pv>)
  }

  public async apply(args: functions.FunctionApplyArguments<I, O, C, Pv, G>): functions.FunctionResult<O, E, C> {
    const mappedArgs = await this.applyProviders(args)
    if (mappedArgs.isFailure) {
      return mappedArgs as any
    }
    return this.execute(0, mappedArgs.value)
  }

  protected async execute(
    middlewareIndex: number,
    args: functions.FunctionArguments<I, O, C, Pv>,
  ): functions.FunctionResult<O, E, C> {
    if (middlewareIndex >= this.middlewares.length) {
      return this.body(args)
    }
    const middleware = this.middlewares[middlewareIndex]
    return middleware.apply(args, (mappedArgs) => this.execute(middlewareIndex + 1, mappedArgs), this)
  }
}

/**
 * Opentelemetry instrumented function.
 */
export class OpentelemetryFunction<
  I extends model.Type,
  O extends model.Type,
  E extends functions.ErrorType,
  C extends functions.OutputRetrieveCapabilities,
  Pv extends provider.Providers,
  G extends guard.Guards,
> extends BaseFunction<I, O, E, C, Pv, G> {
  public readonly tracer: TracerWrapper
  private readonly counter: Counter
  private readonly histogram: Histogram

  constructor(
    func: functions.Function<I, O, E, C, Pv, G>,
    name: string,
    opentelemetry: {
      tracer: Tracer
      counter: Counter
      histogram: Histogram
    },
  ) {
    super(func, name)
    this.tracer = new TracerWrapper(opentelemetry.tracer, '')
    this.counter = opentelemetry.counter
    this.histogram = opentelemetry.histogram
  }

  public async apply(args: functions.FunctionApplyArguments<I, O, C, Pv, G>): functions.FunctionResult<O, E, C> {
    this.counter.add(1)
    const startTime = new Date().getTime()
    const spanResult = await this.tracer.startActiveSpanWithOptions(
      `mondrian:function-apply:${this.name}`,
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          retrieve: JSON.stringify(args.retrieve),
        },
      },
      async (span) => {
        try {
          //TODO: add active span for providers and input decoding?
          const mappedArgs = await this.applyProviders(args)
          if (mappedArgs.isFailure) {
            this.addInputToSpanAttribute(span, args.input)
            span.setStatus({ code: SpanStatusCode.ERROR })
            span.end()
            return result.ok(mappedArgs as any)
          }

          const applyResult = (await super.execute(0, mappedArgs.value)) as result.Result<
            unknown,
            Record<string, unknown>
          >
          if (applyResult.isFailure) {
            this.addErrorsToSpanAttribute(span, applyResult.error)
            this.addInputToSpanAttribute(span, args.input)
            span.setStatus({ code: SpanStatusCode.ERROR })
          } else {
            span.setStatus({ code: SpanStatusCode.OK })
          }
          span.end()
          return result.ok(applyResult)
        } catch (error) {
          this.addInputToSpanAttribute(span, args.input)
          if (error instanceof Error) {
            span.recordException(error)
          }
          span.setStatus({ code: SpanStatusCode.ERROR })
          span.end()
          return result.fail(error)
        }
      },
    )
    const endTime = new Date().getTime()
    this.histogram.record(endTime - startTime)
    if (spanResult.isFailure) {
      throw spanResult.error
    }
    return spanResult.value
  }

  private addErrorsToSpanAttribute(span: Span, failure: Record<string, unknown>) {
    if (!this.errors) {
      return
    }
    const encodedErrors: Record<string, unknown> = {}
    for (const [errorKey, errorValue] of Object.entries(failure)) {
      const concreteErrorType = model.concretise(this.errors[errorKey])
      encodedErrors[errorKey] = concreteErrorType.encodeWithoutValidation(errorValue as never, {
        sensitiveInformationStrategy: 'hide',
      })
    }
    span.setAttribute(`error.json`, JSON.stringify(encodedErrors))
  }

  private addInputToSpanAttribute(span: Span, input: unknown) {
    const concreteInputType = model.concretise(this.input)
    const encodedInput = concreteInputType.encodeWithoutValidation(input as never, {
      sensitiveInformationStrategy: 'hide',
    })
    span.setAttribute('input.json', JSON.stringify(encodedInput))
  }
}