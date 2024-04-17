import { hasNestedPromises, reolsveNestedPromises } from '../src/utils'
import { expect, test } from 'vitest'

test('reolsveNestedPromises', async () => {
  const now = new Date()
  const r1 = await reolsveNestedPromises({
    a: Promise.resolve(1),
    b: Promise.resolve([Promise.resolve(2), Promise.resolve(3)]),
    c: Promise.resolve({ d: Promise.resolve(4), e: Promise.resolve(5) }),
    d: now,
  })
  expect(r1).toEqual({ a: 1, b: [2, 3], c: { d: 4, e: 5 }, d: now })

  const r2 = await reolsveNestedPromises(Promise.resolve(1))
  expect(r2).toEqual(1)

  const r3 = await reolsveNestedPromises(Promise.resolve(null))
  expect(r3).toEqual(null)
})

test('hasNestedPromises', async () => {
  const r1 = await hasNestedPromises({
    a: 1,
    b: [2, 3],
    c: { d: 4, e: 5 },
    e: [],
    f: {},
  })
  expect(r1).toEqual(false)

  const r2 = await hasNestedPromises({
    a: 1,
    b: [2, Promise.resolve(3)],
    c: { d: 4, e: 5 },
  })
  expect(r2).toEqual(true)

  const r3 = await hasNestedPromises({
    a: 1,
    b: [2, 3],
    c: { d: 4, e: Promise.resolve(5) },
  })
  expect(r3).toEqual(true)

  const r4 = await hasNestedPromises(Promise.resolve(1))
  expect(r4).toEqual(true)

  const r5 = await hasNestedPromises(Promise.resolve(null))
  expect(r5).toEqual(true)
})
