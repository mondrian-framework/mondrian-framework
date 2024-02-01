import { model, path } from '../../src'
import jsonwebtoken from 'jsonwebtoken'
import { expect, test } from 'vitest'

test('jwt decoding', () => {
  const jwtType = model.jwt({ foo: model.string({ minLength: 10 }) }, 'ES256')

  const expectedError0 = [{ expected: 'jwt', got: 123, path: path.root }]
  const res0 = jwtType.decode(123)
  expect(res0.isFailure && res0.error).toEqual(expectedError0)

  const expectedError1 = [{ expected: 'jwt', got: '123', path: path.root }]
  const res1 = jwtType.decode('123')
  expect(res1.isFailure && res1.error).toEqual(expectedError1)

  const jwt2 = jsonwebtoken.sign({ foo: 123 }, 'secret')
  const expectedError2 = [{ expected: 'string', got: 123, path: '$.foo' }]
  const res2 = jwtType.decode(jwt2)
  expect(res2.isFailure && res2.error).toEqual(expectedError2)

  const jwt3 = jsonwebtoken.sign({ bar: '123' }, 'secret')
  const expectedError3 = [{ expected: 'string', path: '$.foo' }]
  const res3 = jwtType.decode(jwt3)
  expect(res3.isFailure && res3.error).toEqual(expectedError3)

  const jwt4 = jsonwebtoken.sign({ foo: '123' }, 'secret')
  const expectedError4 = [{ assertion: 'string shorter than min length (10)', got: '123', path: '$.foo' }]
  const res4 = jwtType.decode(jwt4)
  expect(res4.isFailure && res4.error).toEqual(expectedError4)

  const jwt5 = jsonwebtoken.sign({ foo: '0123456789' }, 'secret')
  const res5 = jwtType.decode(jwt5)
  expect(res5.isOk && res5.value).toEqual({ jwt: jwt5, payload: { foo: '0123456789' } })
})
