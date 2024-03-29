import { functions } from '..'
import { Tracer, Span, SpanOptions } from '@opentelemetry/api'

export class VoidTracer implements functions.Tracer {
  public startActiveSpan<F extends (span?: Span) => unknown>(_: string, fn: F): ReturnType<F> {
    return fn(undefined) as ReturnType<F>
  }
  public startActiveSpanWithOptions<F extends (span?: Span) => unknown>(
    _: string,
    _options: SpanOptions,
    fn: F,
  ): ReturnType<F> {
    return fn(undefined) as ReturnType<F>
  }
}
export const voidTracer = new VoidTracer()

export class TracerWrapper implements functions.Tracer {
  readonly tracer: Tracer
  constructor(tracer: Tracer, prefix: string) {
    this.tracer = tracer
  }
  public startActiveSpan<F extends (span: Span) => unknown>(name: string, fn: F): ReturnType<F> {
    return this.startActiveSpanWithOptions(name, {}, fn)
  }
  public startActiveSpanWithOptions<F extends (span: Span) => unknown>(
    name: string,
    options: SpanOptions,
    fn: F,
  ): ReturnType<F> {
    return this.tracer.startActiveSpan(name, options, fn)
  }
}
