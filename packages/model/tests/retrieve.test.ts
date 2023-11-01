import { retrieve, types } from '../src/index'
import { test } from '@fast-check/vitest'
import { JSONType, mapObject } from '@mondrian-framework/utils'
import { describe, expect, expectTypeOf } from 'vitest'

const user = () =>
  types.entity(
    {
      name: types.string(),
      bestFriend: types.optional(user),
      posts: types.array(types.optional(post)),
      metadata,
    },
    {
      name: 'User',
    },
  )
const metadata = () =>
  types.object({
    registeredAt: types.dateTime(),
    loggedInAt: types.dateTime(),
  })
const post = () =>
  types.entity(
    {
      title: types.string(),
      content: types.string(),
      author: user,
      tags: types.array(types.object({ type: types.string(), value: types.string().nullable() })),
    },
    { name: 'Post' },
  )

describe('trimToSelection', () => {
  test('empty trim', () => {
    const res = retrieve.trimToSelection(user, { select: {} }, { name: 'Jonh' })
    expect(res.isOk && res.value).toStrictEqual({})
  })
  test('select one scalar', () => {
    const res1 = retrieve.trimToSelection(user, { select: { name: true } }, { name: 'Jonh' })
    expect(res1.isOk && res1.value).toStrictEqual({ name: 'Jonh' })
    const res2 = retrieve.trimToSelection(user, { select: { name: true } }, {})
    expect(res2.isOk).toBe(false)
    const res3 = retrieve.trimToSelection(user, { select: { name: true } }, { name: 1 as any })
    expect(res3.isOk).toBe(false)
  })
  test('select one scalar and one entity', () => {
    const res1 = retrieve.trimToSelection(user, { select: { name: true, posts: {} } }, { name: 'Jonh' })
    expect(res1.isOk && res1.value).toStrictEqual({ name: 'Jonh' })
    const res2 = retrieve.trimToSelection(user, { select: { name: true, posts: { select: {} } } }, { name: 'Jonh' })
    expect(res2.isOk).toBe(false)
    const res3 = retrieve.trimToSelection(
      user,
      { select: { name: true, posts: { select: {} } } },
      { name: 'Jonh', posts: [{ title: 'Title' }] },
    )
    expect(res3.isOk && res3.value).toStrictEqual({ name: 'Jonh', posts: [{}] })
    const res4 = retrieve.trimToSelection(
      user,
      { select: { name: true, posts: { select: { title: true } } } },
      { name: 'Jonh', posts: [{ title: 'Title' }] },
    )
    expect(res4.isOk && res4.value).toStrictEqual({ name: 'Jonh', posts: [{ title: 'Title' }] })
  })
  test('select one whole embedded', () => {
    const now = new Date()
    const res1 = retrieve.trimToSelection(
      user,
      { select: { metadata: true } },
      { metadata: { loggedInAt: now, registeredAt: now } },
    )
    expect(res1.isOk && res1.value).toStrictEqual({ metadata: { loggedInAt: now, registeredAt: now } })
    const res2 = retrieve.trimToSelection(user, { select: { metadata: true } }, { metadata: { registeredAt: now } })
    expect(res2.isOk).toBe(false)
  })
})

describe('merge', () => {
  test('simple retrieve', () => {
    const result = retrieve.merge(
      user,
      { select: { name: true, posts: true }, where: { id: { equals: 'u2' } } },
      {
        select: { posts: { where: { id: { equals: 'p1' } }, select: { content: true } } },
        where: { name: { equals: 'Mario' } },
      },
    )
    expect(result).toEqual({
      where: { AND: [{ id: { equals: 'u2' } }, { name: { equals: 'Mario' } }] },
      select: {
        name: true,
        posts: { where: { id: { equals: 'p1' } }, select: { title: true, content: true, author: true, tags: true } },
      },
    })
  })
})

test('selectionDepth', () => {
  expect(retrieve.selectionDepth(user, {})).toBe(1)
  expect(retrieve.selectionDepth(user, { select: { name: true } })).toBe(1)
  expect(retrieve.selectionDepth(user, { select: { metadata: true } })).toBe(1)
  expect(retrieve.selectionDepth(user, { select: { metadata: { select: { loggedInAt: true } } } })).toBe(1)
  expect(retrieve.selectionDepth(user, { select: { bestFriend: true } })).toBe(2)
  expect(retrieve.selectionDepth(user, { select: { bestFriend: {} } })).toBe(2)
  expect(retrieve.selectionDepth(user, { select: { bestFriend: { select: {} } } })).toBe(2)
  expect(retrieve.selectionDepth(user, { select: { bestFriend: { select: { name: true } } } })).toBe(2)
  expect(retrieve.selectionDepth(user, { select: { bestFriend: { select: { posts: true } } } })).toBe(3)
  expect(retrieve.selectionDepth(types.string(), null as never)).toBe(1)
})

describe('fromType', () => {
  test('empty retrieve', () => {
    const computedUserRetrieve = retrieve.fromType(user, {})
    const expectedUserRetrieve = types.object({})
    expect(computedUserRetrieve.isOk).toBe(true)
    if (computedUserRetrieve.isOk) {
      expect(types.areEqual(expectedUserRetrieve, computedUserRetrieve.value)).toBe(true)
    }
  })
  test('no retrieve', () => {
    const computedUserRetrieve = retrieve.fromType(user, undefined)
    expect(computedUserRetrieve.isOk).toBe(false)
  })
  test('invalid type for retrieve', () => {
    const computedUserRetrieve = retrieve.fromType(types.array(types.object({})), { select: true })
    expect(computedUserRetrieve.isOk).toBe(false)
  })
  test('invalid type for retrieve', () => {
    //TODO: need deep concretization
    /*
    expect(() =>
      retrieve.fromType(types.entity({ users: types.array(types.array(user)) }), {
        select: true,
      }),
    ).toThrow('Array of array not supported in selection')
    expect(() =>
      retrieve.fromType(types.entity({ users: types.array(types.array(user)) }), {
        where: true,
      }),
    ).toThrow('Array of array not supported in where')
    */
  })
  test('complete retrieve', () => {
    const computedUserRetrieve = retrieve.fromType(user, {
      where: true,
      select: true,
      orderBy: true,
      take: true,
      skip: true,
    })
    const expectedUserRetrieve = () =>
      types.object({
        select: types.optional(userSelect),
        where: types.optional(userWhere),
        orderBy: types.mutableArray(userOrderBy).optional(),
        skip: types.integer({ minimum: 0 }).optional(),
        take: types.integer({ minimum: 0, maximum: 20 }).optional(),
      })
    type ExpectedUserRetrieveType = types.Infer<typeof expectedUserRetrieve>
    type GeneratedUserRetrieve = retrieve.FromType<
      typeof user,
      { where: true; select: true; orderBy: true; take: true; skip: true }
    >
    expectTypeOf<GeneratedUserRetrieve>().toMatchTypeOf<ExpectedUserRetrieveType>()
    expectTypeOf<ExpectedUserRetrieveType>().toMatchTypeOf<GeneratedUserRetrieve>()

    const expectedPostRetrieve = () =>
      types.object({
        select: types.optional(postSelect),
        where: types.optional(postWhere),
        orderBy: types.mutableArray(postOrderBy).optional(),
        skip: types.integer({ minimum: 0 }).optional(),
        take: types.integer({ minimum: 0, maximum: 20 }).optional(),
      })

    const userSelect = () =>
      types.object(
        {
          name: types.boolean().optional(),
          bestFriend: types
            .union({ retrieve: types.object({ select: types.optional(userSelect) }), all: types.boolean() })
            .optional(),
          posts: types.union({ retrieve: expectedPostRetrieve, all: types.boolean() }).optional(),
          metadata: types
            .union({
              fields: types.object({
                select: types
                  .object({
                    registeredAt: types.boolean().optional(),
                    loggedInAt: types.boolean().optional(),
                  })
                  .optional(),
              }),
              all: types.boolean(),
            })
            .optional(),
        },
        { name: 'UserSelect' },
      )

    const postSelect = () =>
      types.object(
        {
          title: types.boolean().optional(),
          content: types.boolean().optional(),
          author: types
            .union({ retrieve: types.object({ select: types.optional(userSelect) }), all: types.boolean() })
            .optional(),
          tags: types
            .union({
              fields: types.object({
                select: types.optional(
                  types.object({ type: types.boolean().optional(), value: types.boolean().optional() }),
                ),
              }),
              all: types.boolean(),
            })
            .optional(),
        },
        { name: 'PostSelect' },
      )

    const userWhere = () =>
      types.object(
        {
          name: types.object({ equals: types.string().optional() }).optional(),
          bestFriend: types.optional(userWhere),
          posts: types
            .object({
              some: types.optional(postWhere),
              every: types.optional(postWhere),
              none: types.optional(postWhere),
            })
            .optional(),
          metadata: types
            .object({
              equals: types
                .object({
                  registeredAt: types.dateTime(),
                  loggedInAt: types.dateTime(),
                })
                .optional(),
            })
            .optional(),
          AND: types.mutableArray(userWhere).optional(),
          OR: types.mutableArray(userWhere).optional(),
          NOT: types.optional(userWhere),
        },
        { name: 'UserWhere' },
      )

    const postWhere = () =>
      types.object(
        {
          title: types.object({ equals: types.string().optional() }).optional(),
          content: types.object({ equals: types.string().optional() }).optional(),
          author: types.optional(userWhere),
          tags: types
            .object({
              equals: types
                .object({
                  type: types.string(),
                  value: types.string().nullable(),
                })
                .array()
                .optional(),
              isEmpty: types.boolean().optional(),
            })
            .optional(),
          AND: types.mutableArray(postWhere).optional(),
          OR: types.mutableArray(postWhere).optional(),
          NOT: types.optional(postWhere),
        },
        { name: 'PostWhere' },
      )

    const userOrderBy = () =>
      types.object(
        {
          name: types.optional(retrieve.sortDirection),
          bestFriend: types.optional(userOrderBy),
          posts: types.object({ _count: types.optional(retrieve.sortDirection) }).optional(),
          metadata: types
            .object({
              registeredAt: types.optional(retrieve.sortDirection),
              loggedInAt: types.optional(retrieve.sortDirection),
            })
            .optional(),
        },
        { name: 'UserOrderBy' },
      )

    const postOrderBy = () =>
      types.object(
        {
          title: types.optional(retrieve.sortDirection),
          content: types.optional(retrieve.sortDirection),
          author: types.optional(userOrderBy),
          tags: types.object({ _count: types.optional(retrieve.sortDirection) }).optional(),
        },
        { name: 'PostOrderBy' },
      )

    expect(computedUserRetrieve.isOk).toBe(true)
    if (computedUserRetrieve.isOk) {
      const s1 = serializeType(expectedUserRetrieve)
      const s2 = serializeType(computedUserRetrieve.value)
      expect(s1).toStrictEqual(s2)
    }
  })
})

function serializeType(type: types.Type, examined: Set<string> = new Set()): JSONType {
  const concreteType = types.concretise(type)
  const name = concreteType.options?.name
  if (name && examined.has(name)) {
    return { $ref: name }
  }
  if (name) {
    examined.add(name)
  }
  return types.match(type, {
    array: ({ wrappedType, options }) => ({
      kind: 'array',
      wrappedType: serializeType(wrappedType, examined),
      options,
    }),
    optional: ({ wrappedType, options }) => ({
      kind: 'optional',
      wrappedType: serializeType(wrappedType, examined),
      options,
    }),
    nullable: ({ wrappedType, options }) => ({
      kind: 'optional',
      wrappedType: serializeType(wrappedType, examined),
      options,
    }),
    string: ({ options }) => ({ kind: 'string', options }),
    number: ({ options }) => ({ kind: 'number', options }),
    boolean: ({ options }) => ({ kind: 'boolean', options }),
    literal: ({ literalValue, options }) => ({ kind: 'literal', literalValue, options }),
    enum: ({ variants, options }) => ({ kind: 'enumeration', variants, options }),
    custom: ({ typeName, options }) => ({ kind: 'custom', typeName, options }),
    object: ({ fields, options }) => ({
      kind: 'object',
      fields: mapObject(fields, (_, fieldType) => serializeType(fieldType, examined)),
      options,
    }),
    entity: ({ fields, options }) => ({
      kind: 'entity',
      fields: mapObject(fields, (_, fieldType) => serializeType(fieldType, examined)),
      options,
    }),
    union: ({ variants, options }) => ({
      kind: 'union',
      variants: mapObject(variants, (_, variantType) => serializeType(variantType, examined)),
      options,
    }),
  })
}
