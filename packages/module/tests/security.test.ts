import { retrieve, security } from '../src'
import {
  PolicyViolation,
  applyMapPolicies,
  checkPolicies,
  isSelectionIncluded,
  isWithinRestriction,
  orderByToSelection,
  selectionToPaths,
  whereToSelection,
} from '../src/security'
import { model } from '@mondrian-framework/model'
import { describe, expect, test } from 'vitest'

const user = () =>
  model.entity({
    id: model.number(),
    name: model.string(),
    age: model.number(),
    metadata: model
      .object({
        registeredAt: model.datetime(),
        loggedInAt: model.datetime().optional(),
      })
      .optional(),
    friends: model.array(user),
    posts: model.array(post),
  })

const post = () =>
  model.entity({
    id: model.number(),
    title: model.string(),
    content: model.string(),
    author: user,
  })

test('mapper policies', () => {
  const policies = security
    .on(user)
    .map((u) => ({ ...u, name: '***' }))
    .on(post)
    .map((p) => ({ ...p, content: '****' }))

  const res = applyMapPolicies({
    outputType: user,
    policies: policies.mapperPolicies,
    value: {
      id: 1,
      name: 'John',
      friends: [{ name: 'Alice' }],
      posts: [{ title: 'asd' }],
    },
  })
  expect(res).toEqual({
    id: 1,
    name: '***',
    friends: [{ name: '***' }],
    posts: [{ title: 'asd', content: '****' }],
  })
})

describe('check guest policies', () => {
  const policies = security
    .on(user)
    .allows({ selection: { name: true } })
    .on(post)
    .allows({ selection: { title: true } })

  test('without capabilities should pass', () => {
    const res = checkPolicies({
      capabilities: {},
      outputType: user,
      path: '$',
      policies: policies.retrievePolicies,
      retrieve: { select: { age: true } },
    })
    expect(res.isOk).toBe(true)
  })

  test('without policies should fail', () => {
    const res = checkPolicies({
      capabilities: retrieve.allCapabilities,
      outputType: user,
      path: '$',
      policies: new Map(),
      retrieve: { select: { age: true } },
    })
    expect(res.isFailure && res.error).toEqual({
      reasons: [],
      path: '$',
    })
  })

  test('selecting forbidden field (level 1) should fail', () => {
    const r1 = checkPolicies({
      capabilities: retrieve.allCapabilities,
      outputType: user,
      path: '$',
      policies: policies.retrievePolicies,
      retrieve: { select: { age: true } },
    })
    expect(r1.isFailure && r1.error).toEqual({
      reasons: [
        {
          applicable: true,
          forbiddenAccess: ['$.age'],
          policy: {
            selection: {
              name: true,
            },
          },
        },
      ],
      path: '$',
    })
  })

  test('selecting forbidden field (level 2) should fail', () => {
    const r1 = checkPolicies({
      capabilities: retrieve.allCapabilities,
      outputType: user,
      path: '$',
      policies: policies.retrievePolicies,
      retrieve: { select: { posts: { select: { content: true } } } },
    })
    expect(r1.isFailure && r1.error).toEqual({
      reasons: [
        {
          applicable: true,
          forbiddenAccess: ['$.content'],
          policy: {
            selection: {
              title: true,
            },
          },
        },
      ],
      path: '$.posts',
    })
  })

  test('allowed selection should pass', () => {
    const r1 = checkPolicies({
      capabilities: retrieve.allCapabilities,
      outputType: user,
      path: '$',
      policies: policies.retrievePolicies,
      retrieve: { select: { name: true, posts: { select: { title: true } } } },
    })
    expect(r1.isOk).toBe(true)
  })
})

describe('check logged user policies', () => {
  const policies = security
    .on(user)
    .allows({ selection: true, restriction: { id: { equals: 1 } } })
    .allows({ selection: { name: true, age: true } })
    .on(post)
    .allows({ selection: true, filter: { author: { id: { equals: 1 } } } })

  test('pass with empty selection', () => {
    const res = checkPolicies({
      capabilities: retrieve.allCapabilities,
      outputType: user,
      path: '$',
      policies: policies.retrievePolicies,
      retrieve: { select: {} },
    })
    expect(res.isOk).toEqual(true)
  })

  test('selection forbidden field should fail', () => {
    const r1 = checkPolicies({
      capabilities: retrieve.allCapabilities,
      outputType: user,
      path: '$',
      policies: policies.retrievePolicies,
      retrieve: { select: { id: true } },
    })
    expect(r1.isFailure && r1.error).toEqual({
      reasons: [
        {
          applicable: true,
          forbiddenAccess: ['$.id'],
          policy: {
            selection: { name: true, age: true },
          },
        },
        {
          applicable: false,
          policy: {
            selection: true,
            restriction: { id: { equals: 1 } },
          },
        },
      ],
      path: '$',
    })
  })

  test('using restriction should be possible to retrieve any field', () => {
    const r1 = checkPolicies({
      capabilities: retrieve.allCapabilities,
      outputType: user,
      path: '$',
      policies: policies.retrievePolicies,
      retrieve: { select: { id: true }, where: { id: { equals: 1 } } },
    })
    expect(r1.isOk).toEqual(true)
  })

  test('should add filter to where condition', () => {
    const r1 = checkPolicies({
      capabilities: { select: true },
      outputType: user,
      path: '$',
      policies: policies.retrievePolicies,
      retrieve: {
        select: { id: true, posts: { select: { content: true }, where: { title: { equals: '...' } } } },
        where: { id: { equals: 1 } },
      },
    })
    expect(r1.isOk && r1.value).toEqual({
      select: {
        id: true,
        posts: {
          select: { content: true },
          where: { AND: [{ title: { equals: '...' } }, { author: { id: { equals: 1 } } }] },
        },
      },
      where: { id: { equals: 1 } },
    })
  })

  test('should add filter to where condition also if selecting all', () => {
    const r1 = checkPolicies({
      capabilities: { select: true },
      outputType: user,
      path: '$',
      policies: policies.retrievePolicies,
      retrieve: {
        select: { id: true, posts: true },
        where: { id: { equals: 1 } },
      },
    })
    expect(r1.isOk && r1.value).toEqual({
      select: {
        id: true,
        posts: {
          select: { id: true, title: true, content: true },
          where: { author: { id: { equals: 1 } } },
        },
      },
      where: { id: { equals: 1 } },
    })
  })

  test('adding filter to where condition if where capability is not enabled should throws', () => {
    const result = () =>
      checkPolicies({
        capabilities: { select: true },
        outputType: post,
        path: '$',
        policies: policies.retrievePolicies,
        retrieve: {
          select: { content: true },
        },
      })
    expect(result).toThrowError(
      'You are trying to use a policy with filter on a function without where capability. Output type: post',
    )
  })

  test('access to forbidden fields in where clausole should fail', () => {
    const r1 = checkPolicies({
      capabilities: retrieve.allCapabilities,
      outputType: user,
      path: '$',
      policies: policies.retrievePolicies,
      retrieve: {
        select: { name: true },
        where: { metadata: { registeredAt: { equals: new Date() } }, posts: { some: { title: { equals: '...' } } } },
      },
    })
    expect(r1.isFailure && r1.error).toEqual({
      path: '$',
      reasons: [
        {
          applicable: true,
          policy: { selection: { name: true, age: true } },
          forbiddenAccess: ['$.metadata.registeredAt'],
        },
        {
          applicable: false,
          policy: { selection: true, restriction: { id: { equals: 1 } } },
        },
      ],
    })
  })

  test('access to forbidden fields in orderBy clausole should fail', () => {
    const r1 = checkPolicies({
      capabilities: retrieve.allCapabilities,
      outputType: user,
      path: '$',
      policies: policies.retrievePolicies,
      retrieve: {
        select: { name: true },
        orderBy: [{ metadata: { registeredAt: 'asc' } }],
      },
    })
    expect(r1.isFailure && r1.error).toEqual({
      path: '$',
      reasons: [
        {
          applicable: true,
          policy: { selection: { name: true, age: true } },
          forbiddenAccess: ['$.metadata.registeredAt'],
        },
        {
          applicable: false,
          policy: { selection: true, restriction: { id: { equals: 1 } } },
        },
      ],
    })
  })
})

test('isSelectionIncluded', () => {
  const [p] =
    security
      .on(user)
      .allows({ selection: { name: true } })
      .retrievePolicies.get(user) ?? []
  const r1 = isSelectionIncluded(p, { name: true })
  expect(r1.isOk).toBe(true)
  const r2 = isSelectionIncluded(p, { name: true, friends: true })
  expect(r2.isOk).toBe(true)
  const r3 = isSelectionIncluded(p, { name: true, age: true })
  expect(r3.isFailure && r3.error).toEqual(['$.age'])
})

test('selectionToPaths', () => {
  const set1 = [...selectionToPaths(user, { name: true, age: false, metadata: true, friends: true }).values()]
  expect(set1).toEqual(['$', '$.name', '$.metadata.registeredAt', '$.metadata.loggedInAt'])

  const set8 = [
    ...selectionToPaths(user, {
      name: true,
      age: false,
      metadata: { select: { loggedInAt: true } },
      friends: true,
    }).values(),
  ]
  expect(set8).toEqual(['$', '$.name', '$.metadata.loggedInAt'])

  const set2 = [...selectionToPaths(user, true).values()]
  expect(set2).toEqual(['$', '$.id', '$.name', '$.age', '$.metadata.registeredAt', '$.metadata.loggedInAt'])

  const set7 = [...selectionToPaths(user, {}).values()]
  expect(set7).toEqual(['$']) //first field selection

  const set3 = [...selectionToPaths(user, undefined).values()]
  expect(set3).toEqual([])

  const set4 = [...selectionToPaths(model.string(), undefined).values()]
  expect(set4).toEqual([])

  const set5 = [...selectionToPaths(model.string(), true).values()]
  expect(set5).toEqual(['$'])

  const set6 = [...selectionToPaths(model.union({ a: model.string(), b: model.string() }), true).values()]
  expect(set6).toEqual([])
})

test('whereToSelection', () => {
  const selection = whereToSelection(model.concretise(user), {
    name: { equals: '...' },
    metadata: { equals: {} },
    posts: {
      some: {
        title: { equals: '...' },
        author: { id: { equals: 1 }, metadata: { AND: [{ loggedInAt: { equals: new Date() } }] } },
        AND: { content: { equals: '' } },
      },
      every: undefined,
    },
  })
  expect(selection).toEqual({
    metadata: true,
    name: true,
    posts: {
      select: {
        title: true,
        content: true,
        author: {
          select: {
            id: true,
            metadata: { select: { loggedInAt: true } },
          },
        },
      },
    },
  })
})

test('orderByToSelection', () => {
  const selection1 = orderByToSelection(model.concretise(user), [
    { name: 'asc', posts: { _count: 'asc' } },
    { metadata: { loggedInAt: 'asc' } },
  ])
  expect(selection1).toEqual({
    name: true,
    metadata: {
      select: {
        loggedInAt: true,
      },
    },
    posts: {
      select: {},
    },
  })

  const selection2 = orderByToSelection(model.concretise(post), [{ content: 'asc', author: { age: 'asc' } }])
  expect(selection2).toEqual({
    content: true,
    author: {
      select: { age: true },
    },
  })
})

test('PolicyViolation type', () => {
  const v: PolicyViolation = {
    path: '$',
    reasons: [],
  }
  expect(model.concretise(PolicyViolation).decode(v).isOk).toBe(true)
})

test('policy builder errors', () => {
  expect(() => security.on(model.array(user))).toThrowError('Policies could be defined only on entity types. Got array')

  expect(() => security.on(user).allows({ selection: true, restriction: {} })).toThrowError(
    'Currently on policy restriction it is supported only on (non array) scalar field.',
  )

  expect(() => security.on(user).allows({ selection: true, restriction: { posts: {} } })).toThrowError(
    'Currently on policy restriction it is supported only on (non array) scalar field.',
  )

  expect(() => security.on(user).allows({ selection: true, restriction: { metadata: {} } })).toThrowError(
    'Currently on policy restriction it is supported only on (non array) scalar field.',
  )

  expect(() => security.on(user).allows({ selection: true, restriction: { asd: {} } as any })).toThrowError(
    'Currently on policy restriction it is supported only on (non array) scalar field.',
  )
})

test('isWithinRestriction', () => {
  const policies = security
    .on(user)
    .allows({
      selection: true,
    })
    .allows({
      selection: true,
      restriction: { id: { equals: 1 } },
    })
    .allows({
      selection: true,
      restriction: { id: { in: [1, 2, 3] } },
    })
  const retrievePolicies = policies.retrievePolicies.get(user) ?? []
  expect(isWithinRestriction(retrievePolicies[0], {})).toBe(true)
  expect(isWithinRestriction(retrievePolicies[0], undefined)).toBe(true)
  expect(isWithinRestriction(retrievePolicies[1], { id: { equals: 1 } })).toBe(true)
  expect(isWithinRestriction(retrievePolicies[1], { id: { equals: 2 } })).toBe(false)
  expect(isWithinRestriction(retrievePolicies[1], {})).toBe(false)
  expect(isWithinRestriction(retrievePolicies[1], undefined)).toBe(false)
  expect(isWithinRestriction(retrievePolicies[1], { id: {} })).toBe(false)
  expect(isWithinRestriction(retrievePolicies[2], { id: { equals: 1 } })).toBe(true)
  expect(isWithinRestriction(retrievePolicies[2], { id: { equals: 2 } })).toBe(true)
  expect(isWithinRestriction(retrievePolicies[2], { id: { in: [1, 2] } })).toBe(true)
  expect(isWithinRestriction(retrievePolicies[2], { id: { in: [1, 2] }, OR: [{ id: { equals: 3 } }] })).toBe(true)
  expect(isWithinRestriction(retrievePolicies[2], { id: { in: [1, 2] }, OR: [{ id: { equals: 4 } }] })).toBe(false)
  expect(isWithinRestriction(retrievePolicies[2], { id: { equals: 4 } })).toBe(false)
  expect(isWithinRestriction(retrievePolicies[2], { id: { equals: 1 }, age: { equals: 2 } })).toBe(true)
  expect(
    isWithinRestriction(retrievePolicies[2], {
      id: { equals: 4 },
      age: { equals: 2 },
      AND: [{ id: { equals: 3 } }],
    }),
  ).toBe(true)
})
