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
  C extends OutputRetrieveCapabilities,
  Context extends Record<string, unknown>,
> implements functions.FunctionImplementation<I, O, E, C, Context>
{
  readonly input: I
  readonly output: O
  readonly errors: E
  readonly retrieve: C
  readonly body: (args: functions.FunctionArguments<I, O, C, Context>) => FunctionResult<O, E, C>
  readonly middlewares: readonly functions.Middleware<I, O, E, C, Context>[]
  readonly options: { readonly namespace?: string | undefined; readonly description?: string | undefined } | undefined

  constructor(func: functions.Function<I, O, E, C, Context>) {
    this.input = func.input
    this.output = func.output
    this.errors = func.errors
    this.retrieve = func.retrieve
    this.body = func.body
    this.middlewares = func.middlewares ?? []
    this.options = func.options
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
