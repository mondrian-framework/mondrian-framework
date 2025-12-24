import { model, path } from '../../src'
import jsonwebtoken from 'jsonwebtoken'
import { describe, expect, test } from 'vitest'

describe('jwt type', () => {
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

  test('jwt encoder throws', () => {
    const jwtType = model.jwt({ foo: model.string() }, 'ES256')
    expect(() => {
      jwtType.encodeWithoutValidation({ jwt: 'test', payload: { foo: 'bar' } })
    }).toThrow('Cannot encode a jwt custom type. Use jsonwebtoken.sign instead.')
  })

  test('jwt arbitrary throws', () => {
    const jwtType = model.jwt({ foo: model.string() }, 'ES256')
    expect(() => {
      jwtType.arbitrary()
    }).toThrow('Cannot generate an arbitrary for a jwt custom type.')
  })

  test('jwt validation succeeds for valid payload', () => {
    const jwtType = model.jwt({ foo: model.string({ minLength: 5 }) }, 'ES256')
    const validJwt = jsonwebtoken.sign({ foo: 'validstring' }, 'secret')
    const decoded = jwtType.decode(validJwt)
    expect(decoded.isOk).toBe(true)
    if (decoded.isOk) {
      const validated = jwtType.validate(decoded.value)
      expect(validated.isOk).toBe(true)
    }
  })

  test('jwt validation fails for invalid payload', () => {
    const jwtType = model.jwt({ foo: model.string({ minLength: 10 }) }, 'ES256')
    // Manually create a value to bypass decoding validation
    const invalidValue = { jwt: 'test', payload: { foo: 'short' } }
    const validated = jwtType.validate(invalidValue as any)
    expect(validated.isFailure).toBe(true)
  })

  test('jwt with nested object payload', () => {
    const jwtType = model.jwt(
      {
        user: model.object({ id: model.number(), name: model.string() }),
        role: model.string(),
      },
      'HS256',
    )

    const validJwt = jsonwebtoken.sign({ user: { id: 1, name: 'John' }, role: 'admin' }, 'secret')
    const result = jwtType.decode(validJwt)
    expect(result.isOk).toBe(true)
    if (result.isOk) {
      expect(result.value.payload).toEqual({ user: { id: 1, name: 'John' }, role: 'admin' })
    }
  })
})
