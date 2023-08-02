import { m, encoder, validator, types, decoder } from '@mondrian-framework/model'
import jsonwebtoken from 'jsonwebtoken'

type JwtOptions = { algorithm: 'HS256' | 'HS384' | 'HS512' } & Omit<
  jsonwebtoken.VerifyOptions,
  'algorithms' | 'complete'
>

const DEFAULT_HS_JWT_ALGORITHM = 'HS256'

export type JWTType<T extends types.ObjectType<any, any>, Name extends string> = m.CustomType<
  `${Name}-jwt`,
  JwtOptions,
  types.Infer<T>
>

export function jwt<T extends types.ObjectType<any, any>, Name extends string>(
  name: Name,
  payloadType: T,
  secret: string,
  options?: m.BaseOptions & JwtOptions,
): JWTType<T, Name> {
  return m.custom(
    `${name}-jwt`,
    (payload) => {
      const encoded = encoder.encode(payloadType, payload)
      const result = jsonwebtoken.sign(encoded as object, secret, {
        algorithm: options?.algorithm ?? DEFAULT_HS_JWT_ALGORITHM,
      })
      return result
    },
    (value) => decodeJwt(value, payloadType, secret, options),
    (payload, options) => validator.validate(payloadType, payload, options),
    options,
  )
}

function decodeJwt<T extends types.Type>(
  value: unknown,
  payloadType: T,
  secret: string,
  options?: JwtOptions,
): decoder.Result<types.Infer<T>> {
  if (typeof value !== 'string') {
    return decoder.baseFail('Invalid JWT type. String expected.', value)
  }
  try {
    const decoded = jsonwebtoken.verify(value, secret, {
      ...options,
      complete: true,
      algorithms: [options?.algorithm ?? DEFAULT_HS_JWT_ALGORITHM],
    })
    return decoder.decodeWithoutValidate(payloadType, decoded.payload)
  } catch {
    return decoder.baseFail('Invalid JWT type. Verify failed.', value)
  }
}
