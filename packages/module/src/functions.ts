import { Logger } from './log'
import { projection, types } from '@mondrian-framework/model'

export type Function<I extends types.Type, O extends types.Type, Context> = {
  input: I
  output: O
  apply: (args: {
    input: types.Infer<I>
    projection: projection.FromType<O> | undefined
    operationId: string
    context: Context
    log: Logger
  }) => Promise<types.Infer<O>> //TODO InferPartialDeep
  opts?: { namespace?: string; description?: string }
}

export type Functions<Contexts extends Record<string, unknown> = Record<string, any>> = {
  [K in keyof Contexts]: Function<types.Type, types.Type, Contexts[K]>
}

export function builder(): FunctionsBuilder {
  return new FunctionsBuilder()
}

class FunctionsBuilder<const Context = unknown> {
  private namespace?: string
  constructor(namespace?: string) {
    this.namespace = namespace
  }
  public withContext<const NewContext>(args?: { namespace?: string }): FunctionsBuilder<NewContext> {
    return new FunctionsBuilder(args?.namespace)
  }
  public build<const I extends types.Type, const O extends types.Type>(
    f: Function<I, O, Context>,
  ): Function<I, O, Context> {
    return { ...f, opts: { ...f.opts, namespace: f.opts?.namespace ?? this.namespace } }
  }
}
