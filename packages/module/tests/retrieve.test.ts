import { retrieve } from '../src/index'
import { test } from '@fast-check/vitest'
import { model } from '@mondrian-framework/model'
import { describe, expect, expectTypeOf } from 'vitest'

const user = () =>
  model.entity(
    {
      name: model.string(),
      bestFriend: model.optional(user),
      posts: model.array(model.optional(post)),
      metadata,
      _count: model.object({ posts: model.integer() }),
    },
    {
      name: 'User',
      retrieve: {
        orderBy: true,
        skip: { max: 10 },
        take: { max: 10 },
        where: true,
      },
    },
  )
const metadata = () =>
  model.object(
    {
      registeredAt: model.datetime(),
      loggedInAt: model.datetime(),
    },
    { name: 'Metadata' },
  )
const post = () =>
  model.entity(
    {
      title: model.string(),
      content: model.string(),
      author: user,
      tags: model.array(model.object({ type: model.string(), value: model.string().nullable() })).setName('Tags'),
    },
    {
      name: 'Post',
      retrieve: {
        skip: { max: 5 },
        take: { max: 30 },
        orderBy: true,
        where: true,
      },
    },
  )

describe('selectedType', () => {
  test('empty trim', () => {
    const type = retrieve.selectedType(user, { select: {} })
    const res = model.concretise(type).decode({ name: 'Jonh' }, { fieldStrictness: 'allowAdditionalFields' })
    expect(res.isOk && res.value).toEqual({})
  })
  test('empty retrieve', () => {
    const type = retrieve.selectedType(user, {})
    const fullObject = { name: 'Jonh', metadata: { registeredAt: new Date(), loggedInAt: new Date() } }
    const res = model.concretise(type).decode(fullObject, {})
    expect(res.isOk && res.value).toEqual(fullObject)
  })
  test('undefiend selection', () => {
    const type = retrieve.selectedType(user, { select: undefined })
    const fullObject = { name: 'Jonh', metadata: { registeredAt: new Date(), loggedInAt: new Date() } }
    const res = model.concretise(type).decode(fullObject, {})
    expect(res.isOk && res.value).toEqual(fullObject)
  })
  test('undefiend sub selection', () => {
    const type = retrieve.selectedType(user, { select: { posts: undefined } })
    const fullObject = {}
    const res = model.concretise(type).decode(fullObject, {})
    expect(res.isOk && res.value).toEqual(fullObject)
  })
  test('empty sub selection', () => {
    const type = retrieve.selectedType(user, { select: { posts: {} } })
    const fullObject = { posts: [{ title: 't', content: 'c', tags: [] }] }
    const res = model.concretise(type).decode(fullObject, {})
    expect(res.isOk && res.value).toEqual(fullObject)
  })
  test('select one scalar', () => {
    const type1 = retrieve.selectedType(user, { select: { name: true } })
    const res1 = model.concretise(type1).decode({ name: 'Jonh' }, { fieldStrictness: 'allowAdditionalFields' })
    expect(res1.isOk && res1.value).toEqual({ name: 'Jonh' })
    const type2 = retrieve.selectedType(user, { select: { name: true } })
    const res2 = model.concretise(type2).decode({}, { fieldStrictness: 'allowAdditionalFields' })
    expect(res2.isOk).toBe(false)
    const type3 = retrieve.selectedType(user, { select: { name: true } })
    const res3 = model.concretise(type2).decode({ name: 1 }, { fieldStrictness: 'allowAdditionalFields' })
    expect(res3.isOk).toBe(false)
  })
  test('select one scalar and one entity', () => {
    const type1 = retrieve.selectedType(user, { select: { name: true, posts: undefined } })
    const res1 = model.concretise(type1).decode({ name: 'Jonh' }, { fieldStrictness: 'allowAdditionalFields' })
    expect(res1.isOk && res1.value).toEqual({ name: 'Jonh' })
    const type2 = retrieve.selectedType(user, { select: { name: true, posts: { select: {} } } })
    const res2 = model.concretise(type2).decode({ name: 'Jonh' }, { fieldStrictness: 'allowAdditionalFields' })
    expect(res2.isOk).toBe(false)
    const type3 = retrieve.selectedType(user, { select: { name: true, posts: { select: {} } } })
    const res3 = model
      .concretise(type3)
      .decode({ name: 'Jonh', posts: [{ title: 'Title' }] }, { fieldStrictness: 'allowAdditionalFields' })
    expect(res3.isOk && res3.value).toEqual({ name: 'Jonh', posts: [{}] })
    const type4 = retrieve.selectedType(user, { select: { name: true, posts: { select: { title: true } } } })
    const res4 = model
      .concretise(type4)
      .decode({ name: 'Jonh', posts: [{ title: 'Title' }] }, { fieldStrictness: 'allowAdditionalFields' })
    expect(res4.isOk && res4.value).toEqual({ name: 'Jonh', posts: [{ title: 'Title' }] })
  })
  test('select one whole embedded', () => {
    const now = new Date()
    const type1 = retrieve.selectedType(user, { select: { metadata: true } })
    const res1 = model
      .concretise(type1)
      .decode({ metadata: { loggedInAt: now, registeredAt: now } }, { fieldStrictness: 'allowAdditionalFields' })
    expect(res1.isOk && res1.value).toEqual({ metadata: { loggedInAt: now, registeredAt: now } })
    const type2 = retrieve.selectedType(user, { select: { metadata: true } })
    const res2 = model
      .concretise(type2)
      .decode({ metadata: { registeredAt: now } }, { fieldStrictness: 'allowAdditionalFields' })
    expect(res2.isOk).toBe(false)
  })

  test('select _count', () => {
    const type1 = retrieve.selectedType(user, { select: { _count: true } })
    const res1 = model.concretise(type1).decode({ _count: { posts: 1 } })
    expect(res1.isOk && res1.value).toEqual({ _count: { posts: 1 } })

    const res2 = model.concretise(type1).decode({ _count: {} })
    expect(res2.isFailure).toBe(true)
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
      { select: { name: true, posts: { select: { tags: true } } }, where: { name: { equals: 'Mario' } } },
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
          select: { content: true, tags: true },
        },
      },
    })
    const result2 = retrieve.merge<retrieve.FromType<typeof user, retrieve.AllCapabilities>>(
      user,
      { select: { name: true }, where: { name: { equals: 'Mario' } } },
      {},
    )
    expect(result2).toEqual({
      where: { name: { equals: 'Mario' } },
      select: { name: true },
    })

    const result3 = retrieve.merge<retrieve.FromType<typeof user, retrieve.AllCapabilities>>(
      user,
      { select: { posts: {} } },
      { select: { posts: {} } },
    )
    expect(result3).toEqual({ select: { posts: {} } })

    const result4 = retrieve.merge<retrieve.FromType<typeof user, retrieve.AllCapabilities>>(
      user,
      {
        select: {
          posts: {
            select: {
              content: true,
              tags: true,
              title: true,
            },
          },
        },
      },
      { select: { posts: {} } },
    )
    expect(result4).toEqual<retrieve.FromType<typeof user, retrieve.AllCapabilities>>({
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

    const result5 = retrieve.merge<retrieve.FromType<typeof user, retrieve.AllCapabilities>>(
      user,
      { select: { posts: { select: { author: {} } } } },
      { select: { posts: {} } },
    )
    expect(result5).toEqual<retrieve.FromType<typeof user, retrieve.AllCapabilities>>({
      select: {
        posts: {
          select: {
            author: {},
          },
        },
      },
    })

    const result6 = retrieve.merge<retrieve.FromType<typeof user, retrieve.AllCapabilities>>(
      user,
      { select: { posts: { select: {} } } },
      { select: { posts: { select: { author: {} } } } },
    )
    expect(result6).toEqual<retrieve.FromType<typeof user, retrieve.AllCapabilities>>({
      select: {
        posts: {
          select: {
            author: {},
          },
        },
      },
    })

    const result7 = retrieve.merge<retrieve.FromType<typeof user, retrieve.AllCapabilities>>(
      user,
      { select: { metadata: { select: { registeredAt: true } } } },
      { select: { metadata: { select: { loggedInAt: true } } } },
    )
    expect(result7).toEqual<retrieve.FromType<typeof user, retrieve.AllCapabilities>>({
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
  expect(retrieve.selectionDepth(model.string(), null as never)).toBe(1)
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
    const computedUserRetrieve = retrieve.fromType(model.array(model.object({})), { select: true })
    expect(computedUserRetrieve.isOk).toBe(false)
  })
  test('invalid type for retrieve', () => {
    //TODO: need deep concretization
    /*
    expect(() =>
      retrieve.fromType(model.entity({ users: model.array(model.array(user)) }), {
        select: true,
      }),
    ).toThrow('Array of array not supported in selection')
    expect(() =>
      retrieve.fromType(model.entity({ users: model.array(model.array(user)) }), {
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

    const userSelect = () =>
      model.object(
        {
          name: model.boolean().optional(),
          bestFriend: model.object({ select: model.optional(userSelect) }).optional(),
          posts: model.optional(expectedPostRetrieve),
          metadata: model
            .union({
              fields: model.object({
                select: model
                  .object({
                    registeredAt: model.boolean().optional(),
                    loggedInAt: model.boolean().optional(),
                  })
                  .optional(),
              }),
              all: model.boolean(),
            })
            .optional(),
          _count: model
            .union({
              fields: model.object({
                select: model.object({ posts: model.boolean().optional() }).optional(),
              }),
              all: model.boolean(),
            })
            .optional(),
        },
        { name: 'UserSelect' },
      )

    const postSelect = () =>
      model.object(
        {
          title: model.boolean().optional(),
          content: model.boolean().optional(),
          author: model.object({ select: model.optional(userSelect) }).optional(),
          tags: model
            .union({
              fields: model.object({
                select: model.optional(
                  model.object({ type: model.boolean().optional(), value: model.boolean().optional() }),
                ),
              }),
              all: model.boolean(),
            })
            .optional(),
        },
        { name: 'PostSelect' },
      )

    const userWhere = () =>
      model.object(
        {
          name: model
            .object({
              equals: model.string().optional(),
              in: model.string().array({ minItems: 1, maxItems: 20 }).mutable().optional(),
            })
            .optional(),
          bestFriend: model.optional(userWhere),
          posts: model
            .object({
              some: model.optional(postWhere),
              every: model.optional(postWhere),
              none: model.optional(postWhere),
            })
            .optional(),
          metadata: model
            .object({
              equals: model.optional(metadata),
            })
            .optional(),
          AND: model.mutableArray(userWhere).optional(),
          OR: model.mutableArray(userWhere).optional(),
          NOT: model.optional(userWhere),
        },
        { name: 'UserWhere' },
      )

    const postWhere = () =>
      model.object(
        {
          title: model
            .object({
              equals: model.string().optional(),
              in: model.string().array({ minItems: 1, maxItems: 20 }).mutable().optional(),
            })
            .optional(),
          content: model
            .object({
              equals: model.string().optional(),
              in: model.string().array({ minItems: 1, maxItems: 20 }).mutable().optional(),
            })
            .optional(),
          author: model.optional(userWhere),
          tags: model
            .object({
              equals: model
                .object({
                  type: model.string(),
                  value: model.string().nullable(),
                })
                .array()
                .mutable()
                .optional(),
              isEmpty: model.boolean().optional(),
            })
            .optional(),
          AND: model.mutableArray(postWhere).optional(),
          OR: model.mutableArray(postWhere).optional(),
          NOT: model.optional(postWhere),
        },
        { name: 'PostWhere' },
      )

    const userOrderBy = () =>
      model.object(
        {
          name: model.optional(retrieve.SortDirection),
          bestFriend: model.optional(userOrderBy),
          posts: model.object({ _count: model.optional(retrieve.SortDirection) }).optional(),
          metadata: model
            .object(
              {
                registeredAt: model.optional(retrieve.SortDirection),
                loggedInAt: model.optional(retrieve.SortDirection),
              },
              { name: 'MetadataOrderBy' },
            )
            .optional(),
        },
        { name: 'UserOrderBy' },
      )

    const postOrderBy = () =>
      model.object(
        {
          title: model.optional(retrieve.SortDirection),
          content: model.optional(retrieve.SortDirection),
          author: model.optional(userOrderBy),
          tags: model.object({ _count: model.optional(retrieve.SortDirection) }).optional(),
        },
        { name: 'PostOrderBy' },
      )

    const expectedUserRetrieve = model.object({
      select: model.optional(userSelect),
      where: model.optional(userWhere),
      orderBy: model.mutableArray(userOrderBy).optional(),
      skip: model.integer({ minimum: 0, maximum: 10 }).optional({ defaultDecodeValue: 0 }),
      take: model.integer({ minimum: 0, maximum: 10 }).optional({ defaultDecodeValue: 10 }),
    })
    type ExpectedUserRetrieveType = model.Infer<typeof expectedUserRetrieve>
    type GeneratedUserRetrieve = retrieve.FromType<
      typeof user,
      { where: true; select: true; orderBy: true; take: true; skip: true }
    >
    expectTypeOf<GeneratedUserRetrieve>().toMatchTypeOf<ExpectedUserRetrieveType>()
    expectTypeOf<ExpectedUserRetrieveType>().toMatchTypeOf<GeneratedUserRetrieve>()

    const g: GeneratedUserRetrieve = { where: { posts: {} } }
    const e: ExpectedUserRetrieveType = { where: { bestFriend: {} } }

    const f: ExpectedUserRetrieveType = g
    const expectedPostRetrieve = model.object({
      select: model.optional(postSelect),
      where: model.optional(postWhere),
      orderBy: model.mutableArray(postOrderBy).optional(),
      skip: model.integer({ minimum: 0, maximum: 5 }).optional({ defaultDecodeValue: 0 }),
      take: model.integer({ minimum: 0, maximum: 30 }).optional({ defaultDecodeValue: 30 }),
    })

    expect(computedUserRetrieve.isOk).toBe(true)
    if (computedUserRetrieve.isOk) {
      expect(model.areEqual(expectedUserRetrieve, computedUserRetrieve.value)).toBe(true)
    }
  })
})
