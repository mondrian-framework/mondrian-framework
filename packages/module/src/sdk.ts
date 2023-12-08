import { functions, module, retrieve, utils } from '.'
import { logger as mondrianLogger } from '.'
import { ErrorType } from './function'
import { result, model } from '@mondrian-framework/model'

export type Sdk<F extends functions.Functions, Metadata> = {
  functions: SdkFunctions<F, Metadata>
  withMetadata: (metadata: Metadata) => Sdk<F, Metadata>
}

type SdkFunctions<F extends functions.Functions, Metadata> = {
  [K in keyof F]: SdkFunction<F[K]['input'], F[K]['output'], F[K]['errors'], F[K]['retrieve'], Metadata>
}

type SdkFunction<
  InputType extends model.Type,
  OutputType extends model.Type,
  E extends ErrorType,
  C extends retrieve.Capabilities | undefined,
  Metadata,
> = IsNever<InputType> extends true
  ? <const P extends retrieve.FromType<OutputType, Exclude<C, undefined>>>(options?: {
      retrieve?: P
      metadata?: Metadata
      operationId?: string
    }) => Promise<SdkFunctionResult<OutputType, E, C, P>>
  : <const P extends retrieve.FromType<OutputType, Exclude<C, undefined>>>(
      input: model.Infer<InputType>,
      options?: { retrieve?: P; metadata?: Metadata; operationId?: string },
    ) => Promise<SdkFunctionResult<OutputType, E, C, P>>

type SdkFunctionResult<
  O extends model.Type,
  E extends ErrorType,
  C extends retrieve.Capabilities | undefined,
  P extends retrieve.FromType<O, C>,
> = [Exclude<E, undefined>] extends [never]
  ? Project<O, P>
  : result.Result<Project<O, P>, { [K in keyof Exclude<E, undefined>]: model.Infer<Exclude<E, undefined>[K]> }>

/**
 * Infer a subset of a Mondrian type `T` based on a retrieve `P`
 * If not explicitly required, all embedded entities are excluded.
 **/
// prettier-ignore
export type Project<T extends model.Type, R extends retrieve.GenericRetrieve>
  = [R] extends [{ select: infer Select }] ? Select extends retrieve.GenericSelect ? InferSelection<T, Select>
    : InferReturn<T>
  : InferReturn<T>

// prettier-ignore
type InferSelection<T extends model.Type, S extends retrieve.GenericSelect> 
  = [S] extends [{ readonly [K in string]?: retrieve.GenericRetrieve | boolean }] ? InferSelectionInternal<T, S>
  : InferReturn<T>

// prettier-ignore
type InferSelectionInternal<T extends model.Type, P extends { readonly [K in string]?: retrieve.GenericRetrieve | boolean }>
  = [T] extends [model.NumberType] ? number
  : [T] extends [model.StringType] ? string
  : [T] extends [model.BooleanType] ? boolean
  : [T] extends [model.LiteralType<infer L>] ? L
  : [T] extends [model.CustomType<any, any, infer InferredAs>] ? InferredAs
  : [T] extends [model.EnumType<infer Vs>] ? Vs[number]
  : [T] extends [model.OptionalType<infer T1>] ? undefined | InferSelectionInternal<T1, P>
  : [T] extends [model.NullableType<infer T1>] ? null | InferSelectionInternal<T1, P>
  : [T] extends [model.ArrayType<infer M, infer T1>] ? M extends model.Mutability.Immutable ? readonly InferSelectionInternal<T1, P>[] : InferSelectionInternal<T1, P>[]
  : [T] extends [model.ObjectType<infer M, infer Ts>] ? InferObject<M, Ts, P>
  : [T] extends [model.EntityType<infer M, infer Ts>] ? InferObject<M, Ts, P>
  : [T] extends [model.UnionType<any>] ? InferReturn<T>
  : [T] extends [(() => infer T1 extends model.Type)] ? InferSelectionInternal<T1, P>
  : never

// prettier-ignore
type InferObject<M extends model.Mutability, Ts extends model.Types, P extends { readonly [K in string]?: retrieve.GenericRetrieve | boolean }> =
  model.ApplyObjectMutability<M,
    //@ts-ignore
    { [Key in (NonUndefinedKeys<P> & model.NonOptionalKeys<Ts>)]: IsObjectOrEntity<Ts[Key]> extends true ? Project<Ts[Key], P[Key]> : InferSelectionInternal<Ts[Key], P[Key]> } &
    //@ts-ignore
    { [Key in (NonUndefinedKeys<P> & model.OptionalKeys<Ts>)]?: IsObjectOrEntity<Ts[Key]> extends true ? Project<Ts[Key], P[Key]> : InferSelectionInternal<Ts[Key], P[Key]> }
  >

type NonUndefinedKeys<P extends Record<string, unknown>> = {
  [K in keyof P]: [Exclude<P[K], undefined>] extends [never] ? never : K
}[keyof P]

// prettier-ignore
type IsObjectOrEntity<T extends model.Type> 
  = [T] extends [model.EntityType<any, any>] ? true
  : [T] extends [model.ObjectType<any, any>] ? true
  : [T] extends [model.OptionalType<infer T1>] ? IsObjectOrEntity<T1>
  : [T] extends [model.NullableType<infer T1>] ? IsObjectOrEntity<T1>
  : [T] extends [model.ArrayType<any, infer T1>] ? IsObjectOrEntity<T1>
  : [T] extends [() => infer T1 extends model.Type] ? IsObjectOrEntity<T1>
  : false

/**
 * Similar to {@link model.Infer Infer} but the embedded entities are inferred as optional.
 * @example ```ts
 *          const Model = () => model.object({
 *            field1: model.number(),
 *            embedded: Model,
 *          })
 *          type Model = model.InferReturn<typeof Model>
 *          // Type = { readonly field1: number, readonly embedded?: Type }
 *          ```
 */
//prettier-ignore
type InferReturn<T extends model.Type>
  = [T] extends [model.NumberType] ? number
  : [T] extends [model.StringType] ? string
  : [T] extends [model.BooleanType] ? boolean
  : [T] extends [model.LiteralType<infer L>] ? L
  : [T] extends [model.CustomType<any, any, infer InferredAs>] ? InferredAs
  : [T] extends [model.EnumType<infer Vs>] ? Vs[number]
  : [T] extends [model.OptionalType<infer T1>] ? undefined | InferReturn<T1>
  : [T] extends [model.NullableType<infer T1>] ? null | InferReturn<T1>
  : [T] extends [model.ArrayType<infer M, infer T1>] ? InferReturnArray<M, T1>
  : [T] extends [model.ObjectType<infer M, infer Ts>] ? InferReturnObject<M, Ts>
  : [T] extends [model.EntityType<infer M, infer Ts>] ? InferReturnEntity<M, Ts>
  : [T] extends [model.UnionType<infer Ts>] ? InferReturnUnion<Ts>
  : [T] extends [(() => infer T1 extends model.Type)] ? InferReturn<T1>
  : never

// prettier-ignore
type InferReturnObject<M extends model.Mutability, Ts extends model.Types> =
  model.ApplyObjectMutability<M,
    { [Key in NonOptionalKeysReturn<Ts>]: InferReturn<Ts[Key]> } &
    { [Key in OptionalKeysReturn<Ts>]?: InferReturn<Ts[Key]> }
  >

// prettier-ignore
type InferReturnEntity<M extends model.Mutability, Ts extends model.Types> =
  model.ApplyObjectMutability<M,
    { [Key in NonOptionalKeysReturn<Ts>]: InferReturn<Ts[Key]> } &
    { [Key in OptionalKeysReturn<Ts>]?: InferReturn<Ts[Key]> }
  >

// prettier-ignore
type InferReturnUnion<Ts extends model.Types> = { [Key in keyof Ts]: InferReturn<Ts[Key]> }[keyof Ts]

// prettier-ignore
type InferReturnArray<M, T extends model.Type> = M extends model.Mutability.Immutable ? readonly InferReturn<T>[] : InferReturn<T>[]

type OptionalKeysReturn<T extends model.Types> = {
  [K in keyof T]: model.IsOptional<T[K]> extends true ? K : IsEntity<T[K]> extends true ? never : never
}[keyof T]

type NonOptionalKeysReturn<T extends model.Types> = {
  [K in keyof T]: model.IsOptional<T[K]> extends true ? never : IsEntity<T[K]> extends true ? never : K
}[keyof T]

//prettier-ignore
type IsEntity<T extends model.Type> 
  = [T] extends [model.EntityType<any, any>] ? true
  : [T] extends [model.OptionalType<infer T1>] ? IsEntity<T1>
  : [T] extends [model.NullableType<infer T1>] ? IsEntity<T1>
  : [T] extends [model.ArrayType<any, infer T1>] ? IsEntity<T1>
  : [T] extends [(() => infer T1 extends model.Type)] ? IsEntity<T1>
  : false

//prettier-ignore
type IsNever<T extends model.Type> 
  = [T] extends [model.CustomType<'never'>] ? true
  : [T] extends [model.OptionalType<any>] ? IsNever<T>
  : [T] extends [model.NullableType<infer T1>] ? IsNever<T1>
  : [T] extends [(() => infer T1 extends model.Type)] ? IsNever<T1>
  : false

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
    const presetLogger = mondrianLogger.build({ moduleName: module.name, server: 'LOCAL' })
    const fs = Object.fromEntries(
      Object.entries(module.functions).map(([functionName, func]) => {
        const wrapper = async (
          input: unknown,
          options?: {
            retrieve?: retrieve.GenericRetrieve
            metadata?: Metadata
            operationId?: string
          },
        ) => {
          const operationId = options?.operationId ?? utils.randomOperationId()
          const thisLogger = presetLogger.updateContext({ operationId, operationName: functionName })
          try {
            const contextInput = await context({ metadata: options?.metadata ?? this.metadata })
            const ctx = await module.context(contextInput, {
              input,
              retrieve: options?.retrieve,
              operationId,
              logger: thisLogger,
              functionName,
            })
            const result = await func.apply({
              input: input as never,
              retrieve: options?.retrieve ?? {},
              context: ctx,
              operationId,
              logger: thisLogger,
            })
            return result
          } catch (error) {
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
