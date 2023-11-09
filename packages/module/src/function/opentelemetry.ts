import { functions } from '..'
import { ErrorType, FunctionResult, OutputRetrieveCapabilities } from '../function'
import { BaseFunction } from './base'
import { result, model } from '@mondrian-framework/model'
import { SpanKind, SpanStatusCode, Counter, Histogram, Tracer, Span, SpanOptions } from '@opentelemetry/api'
import { isPromise } from 'util/types'

/**
 * Opentelemetry instrumented function.
 */
export class OpentelemetryFunction<
  I extends model.Type,
  O extends model.Type,
  E extends ErrorType,
  C extends OutputRetrieveCapabilities,
  Context extends Record<string, unknown>,
> extends BaseFunction<I, O, E, C, Context> {
  private readonly name: string
  public readonly tracer: TracerWrapper
  private readonly counter: Counter
  private readonly histogram: Histogram

  constructor(
    func: functions.Function<I, O, E, C, Context>,
    name: string,
    opentelemetry: {
      tracer: Tracer
      counter: Counter
      histogram: Histogram
    },
  ) {
    super(func)
    this.name = name
    this.tracer = new TracerWrapper(opentelemetry.tracer, '')
    this.counter = opentelemetry.counter
    this.histogram = opentelemetry.histogram
  }

  public async apply(args: functions.FunctionArguments<I, O, C, Context>): FunctionResult<O, E, C> {
    this.counter.add(1)
    const startTime = new Date().getTime()
    const spanResult = await this.tracer.startActiveSpanWithOptions(
      `mondrian:function-apply:${this.name}`,
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          operationId: args.operationId,
          retrieve: JSON.stringify(args.retrieve),
        },
      },
      async (span) => {
        try {
          const applyResult = await this.executeWithinSpan(0, args, span)
          span.setStatus({ code: SpanStatusCode.OK })
          span.end()
          return result.ok(applyResult)
        } catch (error) {
          const concreteInputType = model.concretise(this.input)
          span.setAttribute(
            'input.json',
            JSON.stringify(
              concreteInputType.encodeWithoutValidation(args.input as never, { sensitiveInformationStrategy: 'hide' }),
            ),
          )
          if (error instanceof Error) {
            span.recordException(error)
          }
          span.setStatus({ code: SpanStatusCode.ERROR })
          span.end()
          return result.fail<model.Infer<model.PartialDeep<O>>, unknown>(error)
        }
      },
    )
    const endTime = new Date().getTime()
    this.histogram.record(endTime - startTime)
    if (!spanResult.isOk) {
      throw spanResult.error
    }
    return spanResult.value
  }

  private async executeWithinSpan(
    middlewareIndex: number,
    args: functions.FunctionArguments<I, O, C, Context>,
    span: Span,
  ): FunctionResult<O, E, C> {
    if (middlewareIndex >= this.middlewares.length) {
      span.addEvent('execution', { type: 'body' })
      return this.body(args)
    }
    const middleware = this.middlewares[middlewareIndex]
    span.addEvent('execution', { type: 'middleware', name: middleware.name })
    return middleware.apply(args, (mappedArgs) => this.executeWithinSpan(middlewareIndex + 1, mappedArgs, span), this)
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
