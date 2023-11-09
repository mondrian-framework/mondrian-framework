import { functions } from '..'
import { ErrorType, FunctionResult, OutputRetrieveCapabilities, Tracer } from '../function'
import { model } from '@mondrian-framework/model'
import { Span, SpanOptions } from '@opentelemetry/api'

/**
 * Basic function implementation.
 */
export class BaseFunction<
  I extends model.Type,
  O extends model.Type,
  E extends ErrorType,
  C extends OutputRetrieveCapabilities,
  Context extends Record<string, unknown>,
> implements functions.FunctionImplementation<I, O, E, C, Context>
{
  readonly input: I
  readonly output: O
  readonly errors?: E
  readonly retrieve?: C
  readonly body: (args: functions.FunctionArguments<I, O, C, Context>) => FunctionResult<O, E, C>
  readonly middlewares: readonly functions.Middleware<I, O, E, C, Context>[]
  readonly options: { readonly namespace?: string | undefined; readonly description?: string | undefined } | undefined
  readonly tracer: Tracer

  constructor(func: functions.Function<I, O, E, C, Context>) {
    this.input = func.input
    this.output = func.output
    this.errors = func.errors
    this.retrieve = func.retrieve
    this.body = func.body
    this.middlewares = func.middlewares ?? []
    this.options = func.options
    this.tracer = VOID_TRACDER
  }

  public apply(args: functions.FunctionArguments<I, O, C, Context>): FunctionResult<O, E, C> {
    return this.execute(0, args)
  }

  private async execute(
    middlewareIndex: number,
    args: functions.FunctionArguments<I, O, C, Context>,
  ): FunctionResult<O, E, C> {
    if (middlewareIndex >= this.middlewares.length) {
      return this.body(args)
    }
    const middleware = this.middlewares[middlewareIndex]
    return middleware.apply(args, (mappedArgs) => this.execute(middlewareIndex + 1, mappedArgs), this)
  }
}

class VoidTracer implements Tracer {
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
const VOID_TRACDER = new VoidTracer()
