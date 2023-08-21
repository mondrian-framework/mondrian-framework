import { functions, logger, module, utils } from '.'
import { projection, types } from '@mondrian-framework/model'

/**
 * Local SDK type.
 */
export type Sdk<F extends functions.Functions, Metadata> = {
  functions: SdkFunctions<F, Metadata>
  withMetadata: (metadata: Metadata) => Sdk<F, Metadata>
}

type SdkFunctions<F extends functions.Functions, Metadata> = {
  [K in keyof F]: SdkFunction<F[K]['input'], F[K]['output'], Metadata>
}

type SdkFunction<InputType extends types.Type, OutputType extends types.Type, Metadata> = <
  const P extends projection.FromType<OutputType>,
>(
  input: types.Infer<InputType>,
  options?: { projection?: P; metadata?: Metadata; operationId?: string },
) => Promise<Project<OutputType, P>>

class SdkBuilder<const Metadata> {
  private metadata?: Metadata

  constructor(metadata?: Metadata) {
    this.metadata = metadata
  }

  public build<const Fs extends functions.Functions, ContextInput>({
    module,
    context,
  }: {
    module: module.Module<Fs, ContextInput>
    context: (args: { metadata?: Metadata }) => Promise<ContextInput>
  }): Sdk<Fs, Metadata> {
    const defaultLogger = logger.withContext({ moduleName: module.name, server: 'LOCAL' })
    const fs = Object.fromEntries(
      Object.entries(module.functions).map(([functionName, func]) => {
        const wrapper = async (
          input: any,
          options?: {
            projection?: projection.Projection
            metadata?: Metadata
            operationId?: string
          },
        ) => {
          const operationId = options?.operationId ?? utils.randomOperationId()
          const log = defaultLogger.build({ operationId, operationName: functionName })
          try {
            const contextInput = await context({ metadata: options?.metadata ?? this.metadata })
            const ctx = await module.context(contextInput, { input, projection: options?.projection, operationId, log })
            const result = await functions.apply(func, {
              input: input as never, //TODO: types.Infer<types.Type> should infer unknown?
              projection: options?.projection as never, //TODO: projection.FromType<types.Type> should infer Projection?
              context: ctx,
              operationId,
              log,
            })
            log('Done.')
            return result
          } catch (error) {
            log(error instanceof Error ? `Call failed. ${error.message}` : `Call failed.`)
            throw error
          }
        }
        return [functionName, wrapper]
      }),
    )
    return {
      functions: fs as unknown as SdkFunctions<Fs, Metadata>,
      withMetadata: (metadata) => withMetadata(metadata).build({ module, context }),
    }
  }
}

export function withMetadata<const Metadata>(metadata?: Metadata): SdkBuilder<Metadata> {
  return new SdkBuilder(metadata)
}

export function build<const Fs extends functions.Functions, ContextInput>(args: {
  module: module.Module<Fs, ContextInput>
  context: (args: { metadata?: unknown }) => Promise<ContextInput>
}): Sdk<Fs, unknown> {
  return withMetadata().build(args)
}

/**
 * Infer a subset of a Mondrian type `T` based on a projection `P`
 * If not explicitly required all {@link types.ReferenceType} fields are ignored.
 */
// prettier-ignore
export type Project<T extends types.Type, P extends projection.Projection> 
  = [projection.Projection] extends [P] ? 
    [keyof Exclude<P, true>] extends [never] ? ProjectInternal<T, P> : InferExcludingReferences<T>
  : ProjectInternal<T, P>

// prettier-ignore
export type ProjectInternal<T extends types.Type, P extends projection.Projection> 
  = [P] extends [true] ? InferExcludingReferences<T>
  : [T] extends [types.OptionalType<infer T1>] ? undefined | Project<T1, P>
  : [T] extends [types.NullableType<infer T1>] ? null | Project<T1, P>
  : [T] extends [types.ReferenceType<infer T1>] ? Project<T1, P>
  : [T] extends [types.UnionType<infer Ts>] ? { [Key in keyof Ts]: { readonly [_P in Key]: Key extends keyof P ? P[Key] extends projection.Projection ? P[Key] extends true ? InferExcludingReferences<Ts[Key]> : Project<Ts[Key], P[Key]> : never : Project<Ts[Key], {}> } }[keyof Ts]
  : [T] extends [types.ObjectType<'immutable', infer Ts>] ? Readonly<{ [Key in NonOptionalKeys<Ts> & keyof P]: P[Key] extends projection.Projection ? Project<Ts[Key], P[Key]> : never } & { [Key in OptionalKeys<Ts> & keyof P]?: P[Key] extends projection.Projection ? Project<Ts[Key], P[Key]> : never }>
  : [T] extends [types.ObjectType<'mutable', infer Ts>] ? { [Key in NonOptionalKeys<Ts> & keyof P]: P[Key] extends projection.Projection ? Project<Ts[Key], P[Key]> : never } & { [Key in OptionalKeys<Ts> & keyof P]?: P[Key] extends projection.Projection ? Project<Ts[Key], P[Key]> : never }
  : [T] extends [types.ArrayType<"immutable", infer T1>] ? readonly Project<T1, P>[]
  : [T] extends [types.ArrayType<'mutable', infer T1>] ? Project<T1, P>[]
  : [T] extends [() => infer T1 extends types.Type] ? Project<T1, P>
  : InferExcludingReferences<T>

// prettier-ignore
type InferExcludingReferences<T extends types.Type>
  = [T] extends [types.UnionType<infer Ts>] ? { [Key in keyof Ts]: { readonly [P in Key]: InferExcludingReferences<Ts[Key]> } }[keyof Ts]
  : [T] extends [types.ObjectType<"immutable", infer Ts>] ? Readonly<{ [Key in NonOptionalKeysNoReferences<Ts>]: InferExcludingReferences<Ts[Key]> } & { [Key in OptionalKeysNoReferences<Ts>]?: InferExcludingReferences<Ts[Key]> }>
  : [T] extends [types.ObjectType<"mutable", infer Ts>] ? { [Key in NonOptionalKeysNoReferences<Ts>]: InferExcludingReferences<Ts[Key]> } & { [Key in OptionalKeysNoReferences<Ts>]?: InferExcludingReferences<Ts[Key]> }
  : [T] extends [types.ArrayType<"immutable", infer T1>] ? readonly InferExcludingReferences<T1>[]
  : [T] extends [types.ArrayType<"mutable", infer T1>] ? InferExcludingReferences<T1>[]
  : [T] extends [types.OptionalType<infer T1>] ? undefined | InferExcludingReferences<T1>
  : [T] extends [types.NullableType<infer T1>] ? null | InferExcludingReferences<T1>
  : [T] extends [types.ReferenceType<infer T1>] ? InferExcludingReferences<T1>
  : [T] extends [types.CustomType<infer _Name, infer _Options, infer InferredAs>] ? InferredAs
  : [T] extends [(() => infer T1 extends types.Type)] ? InferExcludingReferences<T1>
  : types.Infer<T>

type OptionalKeysNoReferences<T extends types.Types> = {
  [K in keyof T]: IsReference<T[K]> extends true ? never : IsOptional<T[K]> extends true ? K : never
}[keyof T]
type NonOptionalKeysNoReferences<T extends types.Types> = {
  [K in keyof T]: IsReference<T[K]> extends true ? never : IsOptional<T[K]> extends true ? never : K
}[keyof T]

//prettier-ignore
type IsReference<T extends types.Type> 
  = [T] extends [types.OptionalType<infer T1>] ? IsReference<T1>
  : [T] extends [types.NullableType<infer T1>] ? IsReference<T1>
  : [T] extends [types.ReferenceType<infer _T1>] ? true
  : [T] extends [() => infer T1 extends types.Type] ? IsReference<T1>
  : false

//TODO: import this from model?
//prettier-ignore
type IsOptional<T extends types.Type> 
  = [T] extends [types.OptionalType<infer _T1>] ? true
  : [T] extends [types.NullableType<infer T1>] ? IsOptional<T1>
  : [T] extends [types.ReferenceType<infer T1>] ? IsOptional<T1>
  : [T] extends [() => infer T1 extends types.Type] ? IsOptional<T1>
  : false
type OptionalKeys<T extends types.Types> = {
  [K in keyof T]: IsOptional<T[K]> extends true ? K : never
}[keyof T]
type NonOptionalKeys<T extends types.Types> = {
  [K in keyof T]: IsOptional<T[K]> extends true ? never : K
}[keyof T]
