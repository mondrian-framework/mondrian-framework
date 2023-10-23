// import { functions, module, utils } from '.'
// import { logger as mondrianLogger } from '.'
// import { ErrorType } from './function'
// import { projection, result, types } from '@mondrian-framework/model'
//
// /**
//  * Local SDK type.
//  */
// export type Sdk<F extends functions.Functions, Metadata> = {
//   functions: SdkFunctions<F, Metadata>
//   withMetadata: (metadata: Metadata) => Sdk<F, Metadata>
// }
//
// type SdkFunctions<F extends functions.Functions, Metadata> = {
//   [K in keyof F]: SdkFunction<F[K]['input'], F[K]['output'], F[K]['error'], Metadata>
// }
//
// type SdkFunction<InputType extends types.Type, OutputType extends types.Type, E extends ErrorType, Metadata> = <
//   const P extends projection.FromType<OutputType>,
// >(
//   input: types.Infer<InputType>,
//   options?: { projection?: P; metadata?: Metadata; operationId?: string },
// ) => Promise<result.Result<Project<OutputType, P>, types.Infer<E>>>
//
// class SdkBuilder<const Metadata> {
//   private metadata?: Metadata
//
//   constructor(metadata?: Metadata) {
//     this.metadata = metadata
//   }
//
//   public build<const Fs extends functions.Functions, ContextInput>({
//     module,
//     context,
//   }: {
//     module: module.Module<Fs, ContextInput>
//     context: (args: { metadata?: Metadata }) => Promise<ContextInput>
//   }): Sdk<Fs, Metadata> {
//     const presetLogger = mondrianLogger.build({ moduleName: module.name, server: 'LOCAL' })
//     const fs = Object.fromEntries(
//       Object.entries(module.functions).map(([functionName, func]) => {
//         const wrapper = async (
//           input: unknown,
//           options?: {
//             projection?: projection.Projection
//             metadata?: Metadata
//             operationId?: string
//           },
//         ) => {
//           const operationId = options?.operationId ?? utils.randomOperationId()
//           const thisLogger = presetLogger.updateContext({ operationId, operationName: functionName })
//           try {
//             const contextInput = await context({ metadata: options?.metadata ?? this.metadata })
//             const ctx = await module.context(contextInput, {
//               input,
//               projection: options?.projection,
//               operationId,
//               logger: thisLogger,
//             })
//             const result = await func.apply({
//               input: input as never,
//               projection: options?.projection as never,
//               context: ctx,
//               operationId,
//               logger: thisLogger,
//             })
//             thisLogger.logInfo('Done.')
//             return result
//           } catch (error) {
//             thisLogger.logError(error instanceof Error ? `Call failed. ${error.message}` : `Call failed.`)
//             throw error
//           }
//         }
//         return [functionName, wrapper]
//       }),
//     )
//     return {
//       functions: fs as unknown as SdkFunctions<Fs, Metadata>,
//       withMetadata: (metadata) => withMetadata(metadata).build({ module, context }),
//     }
//   }
// }
//
// export function withMetadata<const Metadata>(metadata?: Metadata): SdkBuilder<Metadata> {
//   return new SdkBuilder(metadata)
// }
//
// export function build<const Fs extends functions.Functions, ContextInput>(args: {
//   module: module.Module<Fs, ContextInput>
//   context: (args: { metadata?: unknown }) => Promise<ContextInput>
// }): Sdk<Fs, unknown> {
//   return withMetadata().build(args)
// }
//
// /**
//  * Infer a subset of a Mondrian type `T` based on a projection `P`
//  * If not explicitly required, all virtual fields are excluded.
//  */
// // prettier-ignore
// export type Project<T extends types.Type, P extends projection.Projection>
//   = [projection.Projection] extends [P] ?
//     [keyof Exclude<P, true>] extends [never] ? ProjectInternal<T, P> : InferExcludingVirtuals<T>
//   : ProjectInternal<T, P>
//
// // prettier-ignore
// type ProjectInternal<T extends types.Type, P extends projection.Projection>
//   = [P] extends [true] ? InferExcludingVirtuals<T>
//   : [T] extends [types.OptionalType<infer T1>] ? undefined | Project<T1, P>
//   : [T] extends [types.NullableType<infer T1>] ? null | Project<T1, P>
//   : [T] extends [types.UnionType<infer Ts>] ? { [Key in keyof Ts]: { readonly [_P in Key]: Key extends keyof P ? P[Key] extends projection.Projection ? P[Key] extends true ? InferExcludingVirtuals<Ts[Key]> : Project<Ts[Key], P[Key]> : never : Project<Ts[Key], {}> } }[keyof Ts]
//   : [T] extends [types.ObjectType<types.Mutability.Immutable, infer Ts>] ? ApplyObjectMutability<types.Mutability.Immutable, { [Key in NonOptionalKeys<Ts> & keyof P]: P[Key] extends projection.Projection ? Project<types.UnwrapField<Ts[Key]>, P[Key]> : never } & { [Key in OptionalKeys<Ts> & keyof P]?: P[Key] extends projection.Projection ? Project<types.UnwrapField<Ts[Key]>, P[Key]> : never }>
//   : [T] extends [types.ObjectType<types.Mutability.Mutable, infer Ts>] ? ApplyObjectMutability<types.Mutability.Mutable, { [Key in NonOptionalKeys<Ts> & keyof P]: P[Key] extends projection.Projection ? Project<types.UnwrapField<Ts[Key]>, P[Key]> : never } & { [Key in OptionalKeys<Ts> & keyof P]?: P[Key] extends projection.Projection ? Project<types.UnwrapField<Ts[Key]>, P[Key]> : never }>
//   : [T] extends [types.ArrayType<types.Mutability.Immutable, infer T1>] ? readonly Project<T1, P>[]
//   : [T] extends [types.ArrayType<types.Mutability.Mutable, infer T1>] ? Project<T1, P>[]
//   : [T] extends [() => infer T1 extends types.Type] ? Project<T1, P>
//   : InferExcludingVirtuals<T>
//
// // prettier-ignore
// type InferExcludingVirtuals<T extends types.Type>
//   = [T] extends [types.UnionType<infer Ts>] ? { [Key in keyof Ts]: { readonly [P in Key]: InferExcludingVirtuals<Ts[Key]> } }[keyof Ts]
//   : [T] extends [types.ObjectType<types.Mutability.Immutable, infer Ts>] ? ApplyObjectMutability<types.Mutability.Immutable, { [Key in NonOptionalKeysNoVirtuals<Ts>]: InferExcludingVirtuals<types.UnwrapField<Ts[Key]>> } & { [Key in OptionalKeysNoVirtuals<Ts>]?: InferExcludingVirtuals<types.UnwrapField<Ts[Key]>> }>
//   : [T] extends [types.ObjectType<types.Mutability.Mutable, infer Ts>] ? ApplyObjectMutability<types.Mutability.Mutable, { [Key in NonOptionalKeysNoVirtuals<Ts>]: InferExcludingVirtuals<types.UnwrapField<Ts[Key]>> } & { [Key in OptionalKeysNoVirtuals<Ts>]?: InferExcludingVirtuals<types.UnwrapField<Ts[Key]>> }>
//   : [T] extends [types.ArrayType<types.Mutability.Immutable, infer T1>] ? readonly InferExcludingVirtuals<T1>[]
//   : [T] extends [types.ArrayType<types.Mutability.Mutable, infer T1>] ? InferExcludingVirtuals<T1>[]
//   : [T] extends [types.OptionalType<infer T1>] ? undefined | InferExcludingVirtuals<T1>
//   : [T] extends [types.NullableType<infer T1>] ? null | InferExcludingVirtuals<T1>
//   : [T] extends [types.CustomType<infer _Name, infer _Options, infer InferredAs>] ? InferredAs
//   : [T] extends [(() => infer T1 extends types.Type)] ? InferExcludingVirtuals<T1>
//   : types.Infer<T>
//
// //prettier-ignore
// type OptionalKeysNoVirtuals<T extends types.Fields> =
//   {
//     [K in keyof T]: T[K] extends { virtual: types.Type } ? never : T[K] extends types.Type ? IsOptional<T[K]> extends K ? K:never : never
//   }[keyof T]
//
// //prettier-ignore
// type NonOptionalKeysNoVirtuals<T extends types.Fields> =
//   {
//     [K in keyof T]:  T[K] extends { virtual: types.Type } ? never : T[K] extends types.Type ? IsOptional<T[K]> extends K ? never:K : never
//   }[keyof T]
//
// //TODO: import this from model?
// //prettier-ignore
// type IsOptional<T extends types.Type>
//   = [T] extends [types.OptionalType<infer _T1>] ? true
//   : [T] extends [types.NullableType<infer T1>] ? IsOptional<T1>
//   : [T] extends [() => infer T1 extends types.Type] ? IsOptional<T1>
//   : false
// type OptionalKeys<T extends types.Fields> = {
//   [K in keyof T]: IsOptional<types.UnwrapField<T[K]>> extends true ? K : never
// }[keyof T]
// type NonOptionalKeys<T extends types.Fields> = {
//   [K in keyof T]: IsOptional<types.UnwrapField<T[K]>> extends true ? never : K
// }[keyof T]
// // prettier-ignore
// type ApplyObjectMutability<M extends types.Mutability, T extends Record<string, unknown>> = M extends types.Mutability.Immutable ? { readonly [K in keyof T]: T[K] } : { [K in keyof T]: T[K] }
