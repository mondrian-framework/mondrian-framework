import { functions } from '..'
import { types } from '@mondrian-framework/model'

export class FunctionImplementation<I extends types.Type, O extends types.Type, Context extends Record<string, unknown>>
  implements functions.Function<I, O, Context>
{
  readonly input: I
  readonly output: O
  readonly body: (args: functions.FunctionArguments<I, O, Context>) => Promise<types.Infer<types.PartialDeep<O>>>
  readonly middlewares: readonly functions.Middleware<I, O, Context>[]
  readonly options: { readonly namespace?: string | undefined; readonly description?: string | undefined } | undefined

  constructor(func: Omit<functions.Function<I, O, Context>, 'apply'>) {
    this.input = func.input
    this.output = func.output
    this.body = func.body
    this.middlewares = func.middlewares ?? []
    this.options = func.options
  }

  public apply(args: functions.FunctionArguments<I, O, Context>): Promise<types.Infer<types.PartialDeep<O>>> {
    return this.execute(0, args)
  }

  private async execute(
    middlewareIndex: number,
    args: functions.FunctionArguments<I, O, Context>,
  ): Promise<types.Infer<types.PartialDeep<O>>> {
    if (middlewareIndex >= this.middlewares.length) {
      return this.body(args)
    }
    const middleware = this.middlewares[middlewareIndex]
    return middleware.apply(args, (mappedArgs) => this.execute(middlewareIndex + 1, mappedArgs), this)
  }
}
