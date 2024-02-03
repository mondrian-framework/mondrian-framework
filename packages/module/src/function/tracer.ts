import { functions } from '..'
import { Tracer, Span, SpanOptions } from '@opentelemetry/api'

export class VoidTracer implements functions.Tracer {
  public withPrefix(_: string): VoidTracer {
    return this
  }
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
