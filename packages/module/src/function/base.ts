import { functions } from '..'
import { ErrorType, FunctionResult, OutputRetrieveCapabilities, Tracer } from '../function'
import { model, result } from '@mondrian-framework/model'
import { Span, SpanOptions } from '@opentelemetry/api'

/**
 * Basic function implementation.
 */
export class BaseFunction<
  I extends model.Type,
  O extends model.Type,
  E extends ErrorType,
  C extends OutputRetrieveCapabilities,
  Pv extends functions.Providers,
> implements functions.FunctionImplementation<I, O, E, C, Pv>
{
  readonly input: I
  readonly output: O
  readonly errors: E
  readonly retrieve: C
  readonly providers: Pv
  readonly body: (args: functions.FunctionArguments<I, O, C, Pv>) => FunctionResult<O, E, C>
  readonly middlewares: readonly functions.Middleware<I, O, E, C, Pv>[]
  readonly options: { readonly namespace?: string | undefined; readonly description?: string | undefined } | undefined
  readonly tracer: Tracer

  constructor(func: functions.Function<I, O, E, C, Pv>) {
    this.input = func.input
    this.output = func.output
    this.errors = func.errors
    this.retrieve = func.retrieve
    this.providers = func.providers
    this.body = func.body
    this.middlewares = func.middlewares ?? []
    this.options = func.options
    this.tracer = voidTracer
  }

  public async applyProviders(
    args: functions.FunctionApplyArguments<I, O, C, Pv>,
  ): Promise<result.Result<functions.FunctionArguments<I, O, C, Pv>, unknown>> {
    const mappedArgs: Record<string, unknown> = {
      input: args.input,
      retrieve: args.retrieve,
      logger: args.logger,
      tracer: args.tracer,
    }
    for (const [providerName, provider] of Object.entries(this.providers)) {
      const res = await provider.apply(args.contextInput, args)
      if (res.isFailure) {
        return res
      }
      mappedArgs[providerName] = res.value
    }
    return result.ok(mappedArgs as functions.FunctionArguments<I, O, C, Pv>)
  }

  public async apply(args: functions.FunctionApplyArguments<I, O, C, Pv>): FunctionResult<O, E, C> {
    const mappedArgs = await this.applyProviders(args)
    if (mappedArgs.isFailure) {
      return mappedArgs as any
    }
    return this.execute(0, mappedArgs.value)
  }

  private async execute(
    middlewareIndex: number,
    args: functions.FunctionArguments<I, O, C, Pv>,
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
export const voidTracer = new VoidTracer()
