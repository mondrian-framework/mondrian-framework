import { functions, guard, provider, retrieve } from '..'
import { model, result } from '@mondrian-framework/model'
import { Span, SpanOptions } from '@opentelemetry/api'

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

  private async execute(
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

class VoidTracer implements functions.Tracer {
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
