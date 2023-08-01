import { result, m, encoder, validate, types, decoder } from '@mondrian-framework/model'
import jsonwebtoken from 'jsonwebtoken'

type JwtOptions = { algorithm: 'HS256' | 'HS384' | 'HS512' } & Omit<
  jsonwebtoken.VerifyOptions,
  'algorithms' | 'complete'
>

const DEFAULT_HS_JWT_ALGORITHM = 'HS256'

export type JWTType<T extends types.Type, Name extends string> = m.CustomType<`${Name}-jwt`, JwtOptions, types.Infer<T>>

export function jwt<T extends types.Type, Name extends string>(
  name: Name,
  payloadType: T,
  secret: string,
  options?: m.BaseOptions & JwtOptions,
): JWTType<T, Name> {
  return m.custom(
    `${name}-jwt`,
    (payload) => {
      const encoded = encoder.encode(payloadType, payload)
      return jsonwebtoken.sign(encoded as object, secret, { algorithm: options?.algorithm ?? DEFAULT_HS_JWT_ALGORITHM })
    },
    (value) => decodeJwt(value, payloadType, secret, options),
    (payload) => validate(payloadType, payload),
    options,
  )
}

function decodeJwt<T extends types.Type>(
  value: unknown,
  payloadType: T,
  secret: string,
  options?: JwtOptions,
): result.Result<types.Infer<T>> {
  if (typeof value !== 'string') {
    return result.error('Invalid JWT type. String expected.', value)
  }
  try {
    const decoded = jsonwebtoken.verify(value, secret, {
      ...options,
      complete: true,
      algorithms: [options?.algorithm ?? DEFAULT_HS_JWT_ALGORITHM],
    })
    return decoder.decode(payloadType, decoded.payload)
  } catch {
    return result.error('Invalid JWT type. Verify failed.', value)
  }
}
