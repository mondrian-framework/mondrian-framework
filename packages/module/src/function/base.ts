import { functions } from '..'
import { ErrorType, FunctionResult, OutputRetrieveCapabilities, Tracer } from '../function'
import { model, result } from '@mondrian-framework/model'
import { mapObject } from '@mondrian-framework/utils'
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
  G extends functions.Guards,
> implements functions.FunctionImplementation<I, O, E, C, Pv, G>
{
  readonly input: I
  readonly output: O
  readonly errors: E
  readonly retrieve: C
  readonly providers: Pv
  readonly guards: G
  readonly body: (args: functions.FunctionArguments<I, O, E, C, Pv>) => FunctionResult<O, E, C>
  readonly middlewares: readonly functions.Middleware<I, O, E, C, Pv, G>[]
  readonly options: { readonly namespace?: string | undefined; readonly description?: string | undefined } | undefined
  readonly tracer: Tracer
  readonly errorsBuilder: Record<string, (error?: unknown) => result.Failure<unknown>>
  readonly okBuilder: (value?: unknown) => result.Ok<unknown>

  constructor(func: functions.Function<I, O, E, C, Pv, G>) {
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
    this.okBuilder = (v) => result.ok(v)
    this.errorsBuilder = mapObject(func.errors ?? {}, (errorCode, errorType) => (error) => {
      if (errorType && typeof errorType === 'object' && 'error' in errorType) {
        return result.fail((errorType as any).error(error)) //using error (see error.ts)
      }
      return result.fail({ [errorCode]: error })
    })
  }

  protected async applyProviders(
    args: functions.FunctionApplyArguments<I, O, C, Pv, G>,
  ): Promise<result.Result<functions.FunctionArguments<I, O, E, C, Pv>, unknown>> {
    const mappedArgs: Record<string, unknown> = {
      input: args.input,
      retrieve: args.retrieve,
      logger: args.logger,
      tracer: args.tracer,
      ok: this.okBuilder,
      errors: this.errorsBuilder,
    }
    for (const [providerName, provider] of Object.entries(this.providers)) {
      const res = await provider.apply(args.contextInput)
      if (res.isFailure) {
        return res
      }
      mappedArgs[providerName] = res.value
    }
    return result.ok(mappedArgs as functions.FunctionArguments<I, O, E, C, Pv>)
  }

  protected async applyGuards(
    args: functions.FunctionApplyArguments<I, O, C, Pv, G>,
  ): Promise<result.Result<undefined, unknown>> {
    for (const guard of Object.values(this.guards)) {
      const res = await guard.apply(args.contextInput)
      if (res && res.isFailure) {
        return res
      }
    }
    return result.ok()
  }

  public async apply(args: functions.FunctionApplyArguments<I, O, C, Pv, G>): FunctionResult<O, E, C> {
    const mappedArgs = await this.applyProviders(args)
    if (mappedArgs.isFailure) {
      return mappedArgs as any
    }
    const guardResult = await this.applyGuards(args)
    if (guardResult.isFailure) {
      return guardResult as any
    }
    return this.execute(0, mappedArgs.value)
  }

  private async execute(
    middlewareIndex: number,
    args: functions.FunctionArguments<I, O, E, C, Pv>,
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
