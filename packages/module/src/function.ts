import { Logger } from './log'
import { projection, types } from '@mondrian-framework/model'

/**
 * Mondrian function type.
 */
export type Function<I extends types.Type, O extends types.Type, Context extends Record<string, unknown>> = {
  input: I
  output: O
  apply: (args: FunctionArguments<I, O, Context>) => Promise<types.InferPartial<O>>
  options?: { namespace?: string; description?: string }
}

export type FunctionArguments<I extends types.Type, O extends types.Type, Context> = {
  input: types.Infer<I>
  projection: projection.FromType<O> | undefined
  operationId: string
  context: Context
  log: Logger
}

type BeforeMiddleware<I extends types.Type, O extends types.Type, Context extends Record<string, unknown>> = (args: {
  args: FunctionArguments<I, O, Context>
  thisFunction: Function<I, O, Context>
}) => FunctionArguments<I, O, Context> | Promise<FunctionArguments<I, O, Context>>

type AfterMiddleware<I extends types.Type, O extends types.Type, Context extends Record<string, unknown>> = (args: {
  args: FunctionArguments<I, O, Context>
  result: types.InferPartial<O>
  thisFunction: Function<I, O, Context>
}) => types.InferPartial<O> | Promise<types.InferPartial<O>>

/**
 * A map of {@link Function}s.
 */
export type Functions<Contexts extends Record<string, Record<string, unknown>> = Record<string, any>> = {
  [K in keyof Contexts]: Function<types.Type, types.Type, Contexts[K]>
}

/**
 * Implementation of {@link FunctionBuilder}.
 */
class FunctionBuilderImpl<
  const I extends types.Type,
  const O extends types.Type,
  const Context extends Record<string, unknown>,
> {
  private readonly func: Partial<Function<I, O, Context>>
  private readonly beforeMiddlewares: BeforeMiddleware<I, O, Context>[] = []
  private readonly afterMiddlewares: AfterMiddleware<I, O, Context>[] = []
  constructor(
    func: Partial<Function<I, O, Context>>,
    beforeMiddlewares: BeforeMiddleware<I, O, Context>[],
    afterMiddlewares: AfterMiddleware<I, O, Context>[],
  ) {
    this.beforeMiddlewares = beforeMiddlewares
    this.afterMiddlewares = afterMiddlewares
    this.func = func
  }
  public context<const Context extends Record<string, unknown>>(): FunctionBuilderImpl<I, O, Context> {
    return new FunctionBuilderImpl(
      { ...this.func, apply: undefined },
      this.beforeMiddlewares as unknown as BeforeMiddleware<I, O, Context>[],
      this.afterMiddlewares as unknown as AfterMiddleware<I, O, Context>[],
    )
  }
  public input<const I extends types.Type>(input: I): FunctionBuilderImpl<I, O, Context> {
    return new FunctionBuilderImpl(
      { ...this.func, input } as Partial<Function<I, O, Context>>,
      this.beforeMiddlewares as unknown as BeforeMiddleware<I, O, Context>[],
      this.afterMiddlewares as unknown as AfterMiddleware<I, O, Context>[],
    )
  }
  public output<const O extends types.Type>(output: O): FunctionBuilderImpl<I, O, Context> {
    return new FunctionBuilderImpl(
      { ...this.func, output } as Partial<Function<I, O, Context>>,
      this.beforeMiddlewares as unknown as BeforeMiddleware<I, O, Context>[],
      this.afterMiddlewares as unknown as AfterMiddleware<I, O, Context>[],
    )
  }
  public body(apply: Function<I, O, Context>['apply']): FunctionBuilderImpl<I, O, Context> {
    return new FunctionBuilderImpl({ ...this.func, apply }, this.beforeMiddlewares, this.afterMiddlewares)
  }
  public options(options: Function<I, O, Context>['options']): FunctionBuilderImpl<I, O, Context> {
    return new FunctionBuilderImpl({ ...this.func, options }, this.beforeMiddlewares, this.afterMiddlewares)
  }
  public before(middlewre: BeforeMiddleware<I, O, Context>): FunctionBuilderImpl<I, O, Context> {
    return new FunctionBuilderImpl(this.func, [...this.beforeMiddlewares, middlewre], this.afterMiddlewares)
  }
  public after(middlewre: AfterMiddleware<I, O, Context>): FunctionBuilderImpl<I, O, Context> {
    return new FunctionBuilderImpl(this.func, this.beforeMiddlewares, [...this.afterMiddlewares, middlewre])
  }
  public build(): Function<I, O, Context> {
    const input = this.func.input
    const output = this.func.output
    const apply = this.func.apply
    if (!input || !output || !apply) {
      throw new Error(`You need to use '.body' before`)
    }
    const thisFunction: Function<I, O, Context> = { ...this.func, apply, input, output }
    return {
      ...this.func,
      input,
      output,
      apply: async (args) => {
        for (const middleware of this.beforeMiddlewares) {
          args = await middleware({ args, thisFunction })
        }
        let result = await apply(args)
        for (const middleware of this.afterMiddlewares) {
          result = await middleware({ args, result, thisFunction })
        }
        return result
      },
    }
  }
}

/**
 * Function builder type.
 */
type FunctionBuilder<
  I extends types.Type,
  O extends types.Type,
  Context extends Record<string, unknown>,
  Excluded extends string,
> = Omit<
  {
    build(): Function<I, O, Context>
    input<const I extends types.Type>(input: I): FunctionBuilder<I, O, Context, Exclude<Excluded | 'input', 'body'>>
    output<const O extends types.Type>(output: O): FunctionBuilder<I, O, Context, Exclude<Excluded | 'output', 'body'>>
    body(
      apply: Function<I, O, Context>['apply'],
    ): FunctionBuilder<I, O, Context, Exclude<Excluded | 'input' | 'output' | 'context' | 'body', 'build'>>
    context<const Context extends Record<string, unknown>>(): FunctionBuilder<
      I,
      O,
      Context,
      Exclude<Excluded | 'context', 'body'>
    >
    options(opts: Function<I, O, Context>['options']): FunctionBuilder<I, O, Context, Excluded>
    before(middlewre: BeforeMiddleware<I, O, Context>): FunctionBuilder<I, O, Context, Excluded>
    after(middlewre: AfterMiddleware<I, O, Context>): FunctionBuilder<I, O, Context, Excluded>
  },
  Excluded
>

/**
 * The function builder singleton. It's used to build any Mondrian function.
 *
 * Example:
 * ```typescript
 * import { types } from '@mondrian-framework/model'
 * import { func } from '@mondrian-framework/module'
 *
 * const loginFunction = func
 *   .input(type.object({ username: types.stirng(), password: types.string() }))
 *   .output(types.string())
 *   .body(async ({ input: { username, password } }) => {
 *     return 'TODO'
 *   }).build()
 * ```
 */
export const builder: FunctionBuilder<types.Type, types.Type, {}, 'build'> = new FunctionBuilderImpl(
  {
    input: types.unknown() as types.Type,
    output: types.unknown() as types.Type,
  },
  [],
  [],
)
