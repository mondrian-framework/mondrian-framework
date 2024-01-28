import { functions, guard, provider } from '..'
import { BaseFunction } from './base'
import { result, model } from '@mondrian-framework/model'
import { SpanKind, SpanStatusCode, Counter, Histogram, Tracer, Span, SpanOptions } from '@opentelemetry/api'

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
          const mappedArgs = await this.applyProviders(args)
          if (mappedArgs.isFailure) {
            return result.ok(mappedArgs as any)
          }

          const applyResult = await this.executeWithinSpan(0, mappedArgs.value, span)
          const applyResult2 = applyResult as result.Result<unknown, Record<string, unknown>>
          if (this.errors && applyResult2.isFailure) {
            this.addErrorsToSpanAttribute(span, applyResult2.error)
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

  private async executeWithinSpan(
    middlewareIndex: number,
    args: functions.FunctionArguments<I, O, C, Pv>,
    span: Span,
  ): functions.FunctionResult<O, E, C> {
    if (middlewareIndex >= this.middlewares.length) {
      return this.body(args)
    }
    const middleware = this.middlewares[middlewareIndex]
    return middleware.apply(args, (mappedArgs) => this.executeWithinSpan(middlewareIndex + 1, mappedArgs, span), this)
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

class TracerWrapper implements functions.Tracer {
  readonly prefix: string
  readonly tracer: Tracer
  constructor(tracer: Tracer, prefix: string) {
    this.tracer = tracer
    this.prefix = prefix
  }
  public withPrefix(prefix: string): TracerWrapper {
    return new TracerWrapper(this.tracer, prefix)
  }
  public startActiveSpan<F extends (span: Span) => unknown>(name: string, fn: F): ReturnType<F> {
    return this.startActiveSpanWithOptions(name, {}, fn)
  }
  public startActiveSpanWithOptions<F extends (span: Span) => unknown>(
    name: string,
    options: SpanOptions,
    fn: F,
  ): ReturnType<F> {
    return this.tracer.startActiveSpan(`${this.prefix}${name}`, options, fn)
  }
}
