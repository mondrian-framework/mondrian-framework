import { error } from '../src'
import { model } from '@mondrian-framework/model'
import { expect, test } from 'vitest'

test('error definition', () => {
  const { unauthorized } = error.define({ unauthorized: { message: 'Unauthorised access.' } })
  expect(
    model.areEqual(
      unauthorized,
      model.object(
        { message: model.literal('Unauthorised access.', { allowUndefinedValue: true }) },
        { name: 'unauthorizedError' },
      ),
    ),
  ).toBe(true)

  const { unauthorized2 } = error.define(
    { unauthorized2: { message: 'Unauthorised access.', details: model.string() } },
    { capitalizeErrorNames: true },
  )
  expect(
    model.areEqual(
      unauthorized2,
      model.object(
        { message: model.literal('Unauthorised access.', { allowUndefinedValue: true }), details: model.string() },
        { name: 'Unauthorized2Error' },
      ),
    ),
  ).toBe(true)
  const { tooManyRequests } = error.define({
    tooManyRequests: {
      message: 'Too many requests.',
      details: model.object({ count: model.number(), max: model.number() }),
    },
  })
  expect(
    model.areEqual(
      tooManyRequests,
      model.object(
        {
          message: model.literal('Too many requests.', { allowUndefinedValue: true }),
          details: model.object({ count: model.number(), max: model.number() }),
        },
        { name: 'tooManyRequestsError' },
      ),
    ),
  ).toBe(true)
})
