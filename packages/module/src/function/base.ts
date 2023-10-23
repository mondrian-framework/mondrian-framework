import { functions } from '..'
import { ErrorType, FunctionResult, OutputRetrieveCapabilities } from '../function'
import { types } from '@mondrian-framework/model'

/**
 * Basic function implementation.
 */
export class BaseFunction<
  I extends types.Type,
  O extends types.Type,
  E extends ErrorType,
  R extends OutputRetrieveCapabilities,
  Context extends Record<string, unknown>,
> implements functions.FunctionImplementation<I, O, E, R, Context>
{
  readonly input: I
  readonly output: O
  readonly error: E
  readonly retrieve: R
  readonly body: (args: functions.FunctionArguments<I, O, R, Context>) => FunctionResult<O, E>
  readonly middlewares: readonly functions.Middleware<I, O, E, R, Context>[]
  readonly options: { readonly namespace?: string | undefined; readonly description?: string | undefined } | undefined

  constructor(func: functions.Function<I, O, E, R, Context>) {
    this.input = func.input
    this.output = func.output
    this.error = func.error
    this.retrieve = func.retrieve
    this.body = func.body
    this.middlewares = func.middlewares ?? []
    this.options = func.options
  }

  public apply(args: functions.FunctionArguments<I, O, R, Context>): FunctionResult<O, E> {
    return this.execute(0, args)
  }

  private async execute(
    middlewareIndex: number,
    args: functions.FunctionArguments<I, O, R, Context>,
  ): FunctionResult<O, E> {
    if (middlewareIndex >= this.middlewares.length) {
      return this.body(args)
    }
    const middleware = this.middlewares[middlewareIndex]
    return middleware.apply(args, (mappedArgs) => this.execute(middlewareIndex + 1, mappedArgs), this)
  }
}
