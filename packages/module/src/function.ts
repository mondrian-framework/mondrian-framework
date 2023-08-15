import { Logger } from './log'
import { projection, types } from '@mondrian-framework/model'

/**
 * Mondrian function type.
 */
export type Function<I extends types.Type, O extends types.Type, Context> = {
  input: I
  output: O
  apply: (args: {
    input: types.Infer<I>
    projection: projection.FromType<O> | undefined
    operationId: string
    context: Context
    log: Logger
  }) => Promise<types.InferPartial<O>>
  options?: { namespace?: string; description?: string }
}

/**
 * A map of {@link Function}s.
 */
export type Functions<Contexts extends Record<string, unknown> = Record<string, any>> = {
  [K in keyof Contexts]: Function<types.Type, types.Type, Contexts[K]>
}

/**
 * Implementation of {@link FunctionBuilder}.
 */
class FunctionBuilderImpl<const I extends types.Type, const O extends types.Type, const Context> {
  private func: Partial<Function<I, O, Context>>
  constructor(func: Partial<Function<I, O, Context>>) {
    this.func = func
  }
  public context<const Context>(): FunctionBuilderImpl<I, O, Context> {
    return new FunctionBuilderImpl({ ...this.func, apply: undefined })
  }
  public input<const I extends types.Type>(input: I): FunctionBuilderImpl<I, O, Context> {
    return new FunctionBuilderImpl({ ...this.func, input } as Partial<Function<I, O, Context>>)
  }
  public output<const O extends types.Type>(output: O): FunctionBuilderImpl<I, O, Context> {
    return new FunctionBuilderImpl({ ...this.func, output } as Partial<Function<I, O, Context>>)
  }
  public body(apply: Function<I, O, Context>['apply']): FunctionBuilderImpl<I, O, Context> {
    return new FunctionBuilderImpl({ ...this.func, apply })
  }
  public options(options: Function<I, O, Context>['options']): FunctionBuilderImpl<I, O, Context> {
    return new FunctionBuilderImpl({ ...this.func, options })
  }
  public build(): Function<I, O, Context> {
    const input = this.func.input
    const output = this.func.output
    const apply = this.func.apply
    if (!input || !output || !apply) {
      throw new Error(`You need to use '.body' before`)
    }
    return { ...this.func, input, output, apply }
  }
}

/**
 * Function builder type.
 */
type FunctionBuilder<I extends types.Type, O extends types.Type, Context, E extends string> = Omit<
  {
    build(): Function<I, O, Context>
    input<const I extends types.Type>(input: I): FunctionBuilder<I, O, Context, Exclude<E | 'build', 'body'>>
    output<const O extends types.Type>(output: O): FunctionBuilder<I, O, Context, Exclude<E | 'build', 'body'>>
    body(apply: Function<I, O, Context>['apply']): FunctionBuilder<I, O, Context, Exclude<E, 'build'>>
    context<const Context>(): FunctionBuilder<I, O, Context, Exclude<E | 'build', 'body'>>
    options(opts: Function<I, O, Context>['options']): FunctionBuilder<I, O, Context, E>
  },
  E
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
export const builder: FunctionBuilder<types.UnknownType, types.UnknownType, {}, 'build'> = new FunctionBuilderImpl({
  input: types.unknown(),
  output: types.unknown(),
})
