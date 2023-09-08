import { functions } from '..'
import { types } from '@mondrian-framework/model'
import { ErrorType, FunctionResult } from 'src/function'

/**
 * Basic function implementation.
 */
export class BaseFunction<
  I extends types.Type,
  O extends types.Type,
  E extends ErrorType,
  Context extends Record<string, unknown>,
> implements functions.FunctionImplementation<I, O, E, Context>
{
  readonly input: I
  readonly output: O
  readonly error: E
  readonly body: (args: functions.FunctionArguments<I, O, Context>) => FunctionResult<O, E>
  readonly middlewares: readonly functions.Middleware<I, O, E, Context>[]
  readonly options: { readonly namespace?: string | undefined; readonly description?: string | undefined } | undefined

  constructor(func: functions.Function<I, O, E, Context>) {
    this.input = func.input
    this.output = func.output
    this.error = func.error
    this.body = func.body
    this.middlewares = func.middlewares ?? []
    this.options = func.options
  }

  public apply(args: functions.FunctionArguments<I, O, Context>): FunctionResult<O, E> {
    return this.execute(0, args)
  }

  private async execute(
    middlewareIndex: number,
    args: functions.FunctionArguments<I, O, Context>,
  ): FunctionResult<O, E> {
    if (middlewareIndex >= this.middlewares.length) {
      return this.body(args)
    }
    const middleware = this.middlewares[middlewareIndex]
    return middleware.apply(args, (mappedArgs) => this.execute(middlewareIndex + 1, mappedArgs), this)
  }
}
