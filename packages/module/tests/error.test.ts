import { error } from '../src'
import { model } from '@mondrian-framework/model'
import { expect, test } from 'vitest'

test('error definition', () => {
  const { unauthorized } = error.define({ unauthorized: { message: 'Unauthorised access.' } })
  expect(
    model.areEqual(
      unauthorized,
      model.object({ message: model.literal('Unauthorised access.'), details: model.null() }, { name: 'unauthorized' }),
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
          message: model.literal('Too many requests.'),
          details: model.object({ count: model.number(), max: model.number() }),
        },
        { name: 'tooManyRequests' },
      ),
    ),
  ).toBe(true)
  const { invalidPassword } = error.define({
    invalidPassword: { message: 'Invalid password', details: model.string().optional().nullable() },
  })
  const { invalidPassword: invalidPassword2 } = error.define({
    invalidPassword: { message: 'Invalid password', details: model.string().nullable() },
  })
  const { invalidPassword: invalidPassword3 } = error.define({
    invalidPassword: { message: 'Invalid password', details: model.null() },
  })

  const v1 = unauthorized.error()
  expect(v1).toEqual({ unauthorized: { message: 'Unauthorised access.', details: null } })
  const v2 = unauthorized.error(undefined)
  expect(v2).toEqual({ unauthorized: { message: 'Unauthorised access.', details: null } })
  const v3 = tooManyRequests.error({ count: 1, max: 10 })
  expect(v3).toEqual({ tooManyRequests: { message: 'Too many requests.', details: { count: 1, max: 10 } } })
  expect(() => (tooManyRequests as any).error()).toThrowError('Type system should have prevented this.')
  //tooManyRequests.error() // should not compile
  const v5 = invalidPassword.error()
  expect(v5).toEqual({ invalidPassword: { message: 'Invalid password', details: undefined } })
  const v6 = invalidPassword.error('Password is too short.')
  expect(v6).toEqual({ invalidPassword: { message: 'Invalid password', details: 'Password is too short.' } })
  const v7 = invalidPassword.error(null)
  expect(v7).toEqual({ invalidPassword: { message: 'Invalid password', details: null } })
  const v8 = invalidPassword2.error()
  expect(v8).toEqual({ invalidPassword: { message: 'Invalid password', details: null } })
  const v9 = invalidPassword3.error()
  expect(v9).toEqual({ invalidPassword: { message: 'Invalid password', details: null } })
})
