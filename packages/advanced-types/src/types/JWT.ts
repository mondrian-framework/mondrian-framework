import { fromRegexes } from './builder'
import { Infer, Result, Type, decode, encode, error, m, validate } from '@mondrian-framework/model'
import jsonwebtoken from 'jsonwebtoken'

const JWT_REGEX = /^[a-zA-Z0-9\-_]+?\.[a-zA-Z0-9\-_]+?\.([a-zA-Z0-9\-_]+)?$/

export function jwt(options?: m.BaseOptions): m.CustomType<'JWT', {}, string> {
  //TODO: regex is not exaustive, check also with jsonwebtoken.decode
  return fromRegexes('JWT', 'Invalid JWT', options, JWT_REGEX)
}

/*
type HsJwtOptions = { algorithm: 'HS256' | 'HS384' | 'HS512' } & Omit<
  jsonwebtoken.VerifyOptions,
  'algorithms' | 'complete'
>

const DEFAULT_HS_JWT_ALGORITHM = 'HS256'

//TODO: to evaluate
export function hsJwt<T extends Type>(
  payloadType: T,
  secret: string,
  options?: m.BaseOptions & HsJwtOptions,
): m.CustomType<'JWT', HsJwtOptions, Infer<T>> {
  return m.custom(
    'JWT',
    (payload) => {
      const encoded = encode(payloadType, payload)
      console.log(
        jsonwebtoken.sign(null as unknown as object, secret, {
          algorithm: options?.algorithm ?? DEFAULT_HS_JWT_ALGORITHM,
        }),
      )
      return jsonwebtoken.sign(encoded as object, secret, { algorithm: options?.algorithm ?? DEFAULT_HS_JWT_ALGORITHM })
    },
    (value) => decodeHsJwt(value, payloadType, secret, options),
    (payload) => validate(payloadType, payload),
    options,
  )
}

function decodeHsJwt<T extends Type>(
  value: unknown,
  payloadType: T,
  secret: string,
  options?: HsJwtOptions,
): Result<Infer<T>> {
  if (typeof value !== 'string') {
    return error('Invalid JWT type. String expected.', value)
  }
  try {
    const decoded = jsonwebtoken.verify(value, secret, {
      ...options,
      complete: true,
      algorithms: [options?.algorithm ?? DEFAULT_HS_JWT_ALGORITHM],
    })
    return decode(payloadType, decoded.payload)
  } catch {
    return error('Invalid JWT type. Verify failed.', value)
  }
}
*/
