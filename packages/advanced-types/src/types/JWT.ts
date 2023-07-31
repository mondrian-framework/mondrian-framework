import { fromRegexes } from './builder'
import { fc as gen } from '@fast-check/vitest'
import { Infer, Type, decode, encode, error, getArbitrary, m, validate } from '@mondrian-framework/model'
import jsonwebtoken from 'jsonwebtoken'

const JWT_REGEX = /^[a-zA-Z0-9\-_]+?\.[a-zA-Z0-9\-_]+?\.([a-zA-Z0-9\-_]+)?$/

export function jwt(options?: m.BaseOptions): m.CustomType<'JWT', {}, string> {
  //TODO: regex is not exaustive, check also with jsonwebtoken.decode
  return fromRegexes('JWT', 'Invalid JWT', options, JWT_REGEX)
}

type HsJwtOptions = { algorithm?: 'HS256' | 'HS384' | 'HS512' } & Omit<
  jsonwebtoken.VerifyOptions,
  'algorithms' | 'complete'
>
//TODO: to evaluate
export function hsJwt<T extends Type>(
  payloadType: T,
  secret: string,
  options?: m.BaseOptions & HsJwtOptions,
): m.CustomType<'JWT', { algorithm?: 'HS256' | 'HS384' | 'HS512' }, Infer<T>> {
  return m.custom(
    'JWT',
    (payload) => {
      const encoded = encode(payloadType, payload) as object
      return jsonwebtoken.sign(encoded, secret, { algorithm: options?.algorithm ?? 'HS256' })
    },
    (value) => {
      if (typeof value !== 'string') {
        return error('Invalid JWT type. String expected.', value)
      }
      const decoded = jsonwebtoken.verify(value, secret, {
        ...options,
        complete: true,
        algorithms: [options?.algorithm ?? 'HS256'],
      })
      if (decoded === null) {
        return error('Invalid JWT type. Verify failed.', value)
      }
      return decode(payloadType, decoded.payload)
    },
    (payload) => validate(payloadType, payload),
    getArbitrary(payloadType),
    options,
  )
}
