import { Project } from '../src/sdk'
import { retrieve, model } from '@mondrian-framework/model'
import { describe, expectTypeOf, test } from 'vitest'

//TODO: fix
test(() => {})
/*
describe('Project', () => {
  test('Infer scalar on scalar type with any projection', () => {
    expectTypeOf<Project<model.NumberType, {}>>().toEqualTypeOf<number>()
    expectTypeOf<Project<model.NumberType, true>>().toEqualTypeOf<number>()
    expectTypeOf<Project<model.StringType, {}>>().toEqualTypeOf<string>()
    expectTypeOf<Project<model.StringType, true>>().toEqualTypeOf<string>()
    expectTypeOf<Project<model.BooleanType, {}>>().toEqualTypeOf<boolean>()
    expectTypeOf<Project<model.BooleanType, true>>().toEqualTypeOf<boolean>()
    expectTypeOf<Project<model.LiteralType<null>, {}>>().toEqualTypeOf<null>()
    expectTypeOf<Project<model.LiteralType<null>, true>>().toEqualTypeOf<null>()
    expectTypeOf<Project<model.DateTimeType, {}>>().toEqualTypeOf<Date>()
    expectTypeOf<Project<model.DateTimeType, true>>().toEqualTypeOf<Date>()
    expectTypeOf<Project<model.EnumType<['A']>, {}>>().toEqualTypeOf<'A'>()
    expectTypeOf<Project<model.EnumType<['A']>, true>>().toEqualTypeOf<'A'>()
  })

  test('Infer scalar on scalar type with any projection with wrapper', () => {
    expectTypeOf<Project<model.NullableType<model.NumberType>, {}>>().toEqualTypeOf<number | null>()
    expectTypeOf<Project<model.OptionalType<model.NumberType>, {}>>().toEqualTypeOf<number | undefined>()
    expectTypeOf<Project<model.ArrayType<model.Mutability.Mutable, model.NumberType>, {}>>().toEqualTypeOf<number[]>()
  })

  test('simple object', () => {
    const user = model.object({ field1: model.string(), field2: model.string() })
    type UserType = typeof user
    expectTypeOf<Project<UserType, {}>>().toEqualTypeOf<Readonly<{}>>()
    expectTypeOf<Project<UserType, { field1: true }>>().toEqualTypeOf<Readonly<{ field1: string }>>()
    expectTypeOf<Project<UserType, true>>().toEqualTypeOf<model.Infer<UserType>>()
  })

  test('recursive object with virtual field', () => {
    const user = () =>
      model.object({ field1: model.string(), field2: model.string(), friend: { virtual: model.optional(user) } })
    type UserType = typeof user
    expectTypeOf<Project<UserType, {}>>().toEqualTypeOf<Readonly<{}>>()
    expectTypeOf<Project<UserType, { field1: true }>>().toEqualTypeOf<Readonly<{ field1: string }>>()
    expectTypeOf<Project<UserType, true>>().toEqualTypeOf<Readonly<{ field1: string; field2: string }>>()
    expectTypeOf<Project<UserType, { friend: true }>>().toEqualTypeOf<
      Readonly<{ friend?: Readonly<{ field1: string; field2: string }> }>
    >()
  })

  test('simple union', () => {
    const union = model.union({
      s: model.object({ field1: model.string(), field2: { virtual: model.number() } }),
      n: model.number(),
    })
    type UnionType = typeof union
    expectTypeOf<Project<UnionType, {}>>().toEqualTypeOf<Readonly<{ n: number } | { s: Readonly<{}> }>>()
    expectTypeOf<Project<UnionType, { s: true }>>().toEqualTypeOf<
      Readonly<{ n: number } | { s: Readonly<{ field1: string }> }>
    >()
    expectTypeOf<Project<UnionType, { s: { field2: true } }>>().toEqualTypeOf<
      Readonly<{ n: number } | { s: Readonly<{ field2: number }> }>
    >()
    expectTypeOf<Project<UnionType, true>>().toEqualTypeOf<
      Readonly<{ n: number } | { s: Readonly<{ field1: string }> }>
    >()
  })

  test('limit case', () => {
    type T = model.ObjectType<model.Mutability.Mutable, { a: model.NumberType; b: { virtual: model.StringType } }>
    type A = Project<T, projection.FromType<T>>
    type C = Project<T, true>
    type B = Project<T, {}>
    type D = Project<T, projection.Projection>

    expectTypeOf<A>().toEqualTypeOf<{ a: number }>()
    expectTypeOf<B>().toEqualTypeOf<{}>()
    expectTypeOf<C>().toEqualTypeOf<{ a: number }>()
    expectTypeOf<D>().toEqualTypeOf<{ a: number }>()

    type E = Project<model.NumberType, projection.FromType<T>>
    type F = Project<types.NumberType, true>
    type G = Project<types.NumberType, {}>
    type H = Project<types.NumberType, projection.Projection>

    expectTypeOf<E>().toEqualTypeOf<number>()
    expectTypeOf<F>().toEqualTypeOf<number>()
    expectTypeOf<G>().toEqualTypeOf<number>()
    expectTypeOf<H>().toEqualTypeOf<number>()

    type T2 = types.UnionType<{ a: types.NumberType; b: T }>
    type I = Project<T2, projection.FromType<T>>
    type L = Project<T2, true>
    type M = Project<T2, {}>
    type N = Project<T2, projection.Projection>

    expectTypeOf<I>().toEqualTypeOf<{ readonly a: number } | { readonly b: { a: number } }>()
    expectTypeOf<L>().toEqualTypeOf<{ readonly a: number } | { readonly b: { a: number } }>()
    expectTypeOf<M>().toEqualTypeOf<{ readonly a: number } | { readonly b: {} }>()
    expectTypeOf<N>().toEqualTypeOf<{ readonly a: number } | { readonly b: { a: number } }>()
  })
})
*/
