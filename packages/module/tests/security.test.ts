import { retrieve, security } from '../src'
import { Project } from '../src/sdk'
import { checkPolicies, isSelectionIncluded, selectionToPaths, whereToPaths } from '../src/security'
import { model, path } from '@mondrian-framework/model'
import { describe, expect, expectTypeOf, test } from 'vitest'

const user = () =>
  model.entity({
    name: model.string(),
    age: model.number(),
    metadata: model
      .object({
        registeredAt: model.datetime(),
      })
      .optional(),
    friends: model.array(user),
    posts: model.array(post),
  })

const post = () =>
  model.entity({
    title: model.string(),
    content: model.string(),
    author: user,
  })

describe('check guest policies', () => {
  const guestPolicies = security
    .on(user)
    .allows({ selection: { name: true } })
    .on(post)
    .allows({ selection: { title: true } }).policies

  test('ok without capabilities', () => {
    const res = checkPolicies({
      capabilities: {},
      outputType: user,
      path: '$',
      policies: guestPolicies,
      retrieve: { select: { age: true } },
    })
    expect(res.isOk).toBe(true)
  })

  test('error without policies', () => {
    const res = checkPolicies({
      capabilities: retrieve.allCapabilities,
      outputType: user,
      path: '$',
      policies: [],
      retrieve: { select: { age: true } },
    })
    expect(res.isFailure && res.error).toEqual({
      allowedSelections: [],
      otherPolicies: [],
      path: '$',
      reason: 'NO_APPLICABLE_POLICIES',
    })
  })

  test('error selecting forbidden field (level 1)', () => {
    const r1 = checkPolicies({
      capabilities: retrieve.allCapabilities,
      outputType: user,
      path: '$',
      policies: guestPolicies,
      retrieve: { select: { age: true } },
    })
    expect(r1.isFailure && r1.error).toEqual({
      allowedSelections: [
        {
          forbiddenRequestedFields: ['$.age'],
          selection: {
            name: true,
          },
        },
      ],
      otherPolicies: [],
      path: '$',
      reason: 'NO_APPLICABLE_POLICIES',
    })
  })

  test('error selecting forbidden field (level 2)', () => {
    const r1 = checkPolicies({
      capabilities: retrieve.allCapabilities,
      outputType: user,
      path: '$',
      policies: guestPolicies,
      retrieve: { select: { posts: { select: { content: true } } } },
    })
    expect(r1.isFailure && r1.error).toEqual({
      allowedSelections: [
        {
          forbiddenRequestedFields: ['$.content'],
          selection: {
            title: true,
          },
        },
      ],
      otherPolicies: [],
      path: '$.posts',
      reason: 'NO_APPLICABLE_POLICIES',
    })
  })
})

test('isSelectionIncluded', () => {
  const [p] = security.on(user).allows({ selection: { name: true } }).policies
  const r1 = isSelectionIncluded(p, { name: true })
  expect(r1.isOk).toBe(true)
  const r2 = isSelectionIncluded(p, { name: true, friends: true })
  expect(r2.isOk).toBe(true)
  const r3 = isSelectionIncluded(p, { name: true, age: true })
  expect(r3.isFailure && r3.error).toEqual(['$.age'])
})

test('selectionToPaths', () => {
  const set1 = [...selectionToPaths(user, { name: true, age: false, metadata: true, friends: true }).values()]
  expect(set1).toEqual(['$.name', '$.metadata.registeredAt'])

  const set2 = [...selectionToPaths(user, true).values()]
  expect(set2).toEqual(['$.name', '$.age', '$.metadata.registeredAt'])

  const set3 = [...selectionToPaths(user, undefined).values()]
  expect(set3).toEqual([])

  const set4 = [...selectionToPaths(model.string(), undefined).values()]
  expect(set4).toEqual([])

  const set5 = [...selectionToPaths(model.string(), true).values()]
  expect(set5).toEqual(['$'])

  const set6 = [...selectionToPaths(model.union({ a: model.string(), b: model.string() }), true).values()]
  expect(set6).toEqual([])
})

test('whereToPaths', () => {
  const user = () =>
    model.entity({
      name: model.string(),
      age: model.number(),
      metadata: model
        .object({
          registeredAt: model.datetime(),
        })
        .optional(),
      friends: model.array(user),
    })
  const set1 = [...whereToPaths(user, { name: { equals: '...' } }).values()]
  expect(set1).toEqual(['$.name'])

  const set2 = [...whereToPaths(user, { name: { equals: '...' } }).values()]
  expect(set2).toEqual(['$.name'])
})
