import { functions } from '..'
import { FunctionImplementation } from './implementation'
import { result, types } from '@mondrian-framework/model'
import { SpanKind, SpanStatusCode, Counter, Histogram, Tracer, Span } from '@opentelemetry/api'

/**
 * Opentelemetry instrumented function.
 */
export class OpentelemetryFunction<
  I extends types.Type,
  O extends types.Type,
  Context extends Record<string, unknown>,
> extends FunctionImplementation<I, O, Context> {
  private readonly name: string
  private readonly tracer: Tracer
  private readonly counter: Counter
  private readonly histogram: Histogram

  public async apply(args: functions.FunctionArguments<I, O, Context>): Promise<types.Infer<types.PartialDeep<O>>> {
    this.counter.add(1)
    const startTime = new Date().getTime()
    const spanResult = await this.tracer.startActiveSpan(
      `mondrian:function-apply:${this.name}`,
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          operationId: args.operationId,
          projection: JSON.stringify(args.projection),
        },
      },
      async (span) => {
        try {
          const r = await this.executeWithinSpan(0, args, span)
          span.setStatus({ code: SpanStatusCode.OK })
          span.end()
          return result.ok<types.Infer<types.PartialDeep<O>>, unknown>(r)
        } catch (error) {
          span.setAttribute(
            'input.json',
            JSON.stringify(types.concretise(this.input).encodeWithoutValidation(args.input as never)), //TODO: hide sensitive data #57
          )
          if (error instanceof Error) {
            span.recordException(error)
          }
          span.setStatus({ code: SpanStatusCode.ERROR })
          span.end()
          return result.fail<types.Infer<types.PartialDeep<O>>, unknown>(error)
        }
      },
    )
    const finishTIme = new Date().getTime()
    this.histogram.record(finishTIme - startTime)
    if (!spanResult.isOk) {
      throw spanResult.error
    }
    return spanResult.value
  }

  private async executeWithinSpan(
    middlewareIndex: number,
    args: functions.FunctionArguments<I, O, Context>,
    span: Span,
  ): Promise<types.Infer<types.PartialDeep<O>>> {
    if (middlewareIndex >= this.middlewares.length) {
      span.addEvent('execution', { type: 'body' })
      return this.body(args)
    }
    const middleware = this.middlewares[middlewareIndex]
    span.addEvent('execution', { type: 'middleware', name: middleware.name })
    return middleware.apply(args, (mappedArgs) => this.executeWithinSpan(middlewareIndex + 1, mappedArgs, span), this)
  }

  constructor(
    func: functions.Function<I, O, Context>,
    name: string,
    opentelemetry: {
      tracer: Tracer
      counter: Counter
      histogram: Histogram
    },
  ) {
    super(func)
    this.name = name
    this.tracer = opentelemetry.tracer
    this.counter = opentelemetry.counter
    this.histogram = opentelemetry.histogram
  }
}
