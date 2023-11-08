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
    registeredAt: types.datetime(),
    loggedInAt: types.datetime(),
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

describe('selectedType', () => {
  test('empty trim', () => {
    const type = retrieve.selectedType(user, { select: {} })
    const res = types.concretise(type).decode({ name: 'Jonh' }, { fieldStrictness: 'allowAdditionalFields' })
    expect(res.isOk && res.value).toEqual({})
  })
  test('select one scalar', () => {
    const type1 = retrieve.selectedType(user, { select: { name: true } })
    const res1 = types.concretise(type1).decode({ name: 'Jonh' }, { fieldStrictness: 'allowAdditionalFields' })
    expect(res1.isOk && res1.value).toEqual({ name: 'Jonh' })
    const type2 = retrieve.selectedType(user, { select: { name: true } })
    const res2 = types.concretise(type2).decode({}, { fieldStrictness: 'allowAdditionalFields' })
    expect(res2.isOk).toBe(false)
    const type3 = retrieve.selectedType(user, { select: { name: true } })
    const res3 = types.concretise(type2).decode({ name: 1 }, { fieldStrictness: 'allowAdditionalFields' })
    expect(res3.isOk).toBe(false)
  })
  test('select one scalar and one entity', () => {
    const type1 = retrieve.selectedType(user, { select: { name: true, posts: {} } })
    const res1 = types.concretise(type1).decode({ name: 'Jonh' }, { fieldStrictness: 'allowAdditionalFields' })
    expect(res1.isOk && res1.value).toEqual({ name: 'Jonh' })
    const type2 = retrieve.selectedType(user, { select: { name: true, posts: { select: {} } } })
    const res2 = types.concretise(type2).decode({ name: 'Jonh' }, { fieldStrictness: 'allowAdditionalFields' })
    expect(res2.isOk).toBe(false)
    const type3 = retrieve.selectedType(user, { select: { name: true, posts: { select: {} } } })
    const res3 = types
      .concretise(type3)
      .decode({ name: 'Jonh', posts: [{ title: 'Title' }] }, { fieldStrictness: 'allowAdditionalFields' })
    expect(res3.isOk && res3.value).toEqual({ name: 'Jonh', posts: [{}] })
    const type4 = retrieve.selectedType(user, { select: { name: true, posts: { select: { title: true } } } })
    const res4 = types
      .concretise(type4)
      .decode({ name: 'Jonh', posts: [{ title: 'Title' }] }, { fieldStrictness: 'allowAdditionalFields' })
    expect(res4.isOk && res4.value).toEqual({ name: 'Jonh', posts: [{ title: 'Title' }] })
  })
  test('select one whole embedded', () => {
    const now = new Date()
    const type1 = retrieve.selectedType(user, { select: { metadata: true } })
    const res1 = types
      .concretise(type1)
      .decode({ metadata: { loggedInAt: now, registeredAt: now } }, { fieldStrictness: 'allowAdditionalFields' })
    expect(res1.isOk && res1.value).toEqual({ metadata: { loggedInAt: now, registeredAt: now } })
    const type2 = retrieve.selectedType(user, { select: { metadata: true } })
    const res2 = types
      .concretise(type2)
      .decode({ metadata: { registeredAt: now } }, { fieldStrictness: 'allowAdditionalFields' })
    expect(res2.isOk).toBe(false)
  })
})

describe('merge', () => {
  test('none', () => {
    const result = retrieve.merge<retrieve.FromType<typeof user, retrieve.AllCapabilities>>(user, undefined, {
      take: 1,
    })
    expect(result).toEqual({ take: 1 })
  })
  test('select and where', () => {
    const now = new Date()
    const result = retrieve.merge<retrieve.FromType<typeof user, retrieve.AllCapabilities>>(
      user,
      { select: { name: true, posts: true }, where: { name: { equals: 'Mario' } } },
      {
        select: { posts: { where: { title: { equals: 'Test' } }, select: { content: true } } },
        where: { metadata: { equals: { loggedInAt: now, registeredAt: now } } },
      },
    )
    expect(result).toEqual({
      where: { AND: [{ name: { equals: 'Mario' } }, { metadata: { equals: { loggedInAt: now, registeredAt: now } } }] },
      select: {
        name: true,
        posts: {
          where: { title: { equals: 'Test' } },
          select: { title: true, content: true, tags: true },
        },
      },
    })
    const resul2 = retrieve.merge<retrieve.FromType<typeof user, retrieve.AllCapabilities>>(
      user,
      { select: { name: true }, where: { name: { equals: 'Mario' } } },
      {},
    )
    expect(resul2).toEqual({
      where: { name: { equals: 'Mario' } },
      select: { name: true },
    })

    const resul3 = retrieve.merge<retrieve.FromType<typeof user, retrieve.AllCapabilities>>(
      user,
      { select: { posts: true } },
      { select: { posts: true } },
    )
    expect(resul3).toEqual({ select: { posts: true } })

    const resul4 = retrieve.merge<retrieve.FromType<typeof user, retrieve.AllCapabilities>>(
      user,
      { select: { posts: true } },
      { select: { posts: {} } },
    )
    expect(resul4).toEqual<retrieve.FromType<typeof user, retrieve.AllCapabilities>>({
      select: {
        posts: {
          select: {
            content: true,
            tags: true,
            title: true,
          },
        },
      },
    })

    const resul5 = retrieve.merge<retrieve.FromType<typeof user, retrieve.AllCapabilities>>(
      user,
      { select: { posts: { select: { author: true } } } },
      { select: { posts: true } },
    )
    expect(resul5).toEqual<retrieve.FromType<typeof user, retrieve.AllCapabilities>>({
      select: {
        posts: {
          select: {
            author: true,
            content: true,
            tags: true,
            title: true,
          },
        },
      },
    })

    const resul6 = retrieve.merge<retrieve.FromType<typeof user, retrieve.AllCapabilities>>(
      user,
      { select: { posts: { select: { author: true } } } },
      { select: { posts: { select: { author: {} } } } },
    )
    expect(resul6).toEqual<retrieve.FromType<typeof user, retrieve.AllCapabilities>>({
      select: {
        posts: {
          select: {
            author: { select: { metadata: true, name: true } },
          },
        },
      },
    })

    const resul7 = retrieve.merge<retrieve.FromType<typeof user, retrieve.AllCapabilities>>(
      user,
      { select: { metadata: { select: { registeredAt: true } } } },
      { select: { metadata: { select: { loggedInAt: true } } } },
    )
    expect(resul7).toEqual<retrieve.FromType<typeof user, retrieve.AllCapabilities>>({
      select: { metadata: { select: { registeredAt: true, loggedInAt: true } } },
    })
  })
  test('order by', () => {
    const result = retrieve.merge<retrieve.FromType<typeof user, retrieve.AllCapabilities>>(
      user,
      { orderBy: [{ name: 'asc', bestFriend: { metadata: { loggedInAt: 'desc' } } }] },
      { orderBy: [{ posts: { _count: 'asc' } }] },
    )
    expect(result).toEqual({
      orderBy: [{ name: 'asc', bestFriend: { metadata: { loggedInAt: 'desc' } } }, { posts: { _count: 'asc' } }],
    })

    const result2 = retrieve.merge<retrieve.FromType<typeof user, retrieve.AllCapabilities>>(
      user,
      { orderBy: [{ name: 'asc', bestFriend: { metadata: { loggedInAt: 'desc' } } }] },
      { orderBy: [{ posts: { _count: 'asc' } }] },
      { orderByOrder: 'right-before' },
    )
    expect(result2).toEqual({
      orderBy: [{ posts: { _count: 'asc' } }, { name: 'asc', bestFriend: { metadata: { loggedInAt: 'desc' } } }],
    })
  })
  test('skip and take', () => {
    const result = retrieve.merge<retrieve.FromType<typeof user, retrieve.AllCapabilities>>(
      user,
      { skip: 1, take: 10 },
      { skip: 2, take: 20 },
    )
    expect(result).toEqual({ skip: 1, take: 10 })

    const result2 = retrieve.merge<retrieve.FromType<typeof user, retrieve.AllCapabilities>>(
      user,
      { skip: 1, take: 10 },
      { skip: 2, take: 20 },
      { skipOrder: 'right-before', takeOrder: 'right-before' },
    )
    expect(result2).toEqual({ skip: 2, take: 20 })

    const result3 = retrieve.merge<retrieve.FromType<typeof user, retrieve.AllCapabilities>>(
      user,
      { skip: 1, take: 10 },
      {},
      { skipOrder: 'right-before', takeOrder: 'right-before' },
    )
    expect(result3).toEqual({ skip: 1, take: 10 })
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
    expect(computedUserRetrieve.isOk).toBe(false)
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
                  registeredAt: types.datetime(),
                  loggedInAt: types.datetime(),
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
