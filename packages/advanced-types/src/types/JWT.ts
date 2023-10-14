import { m, types, decoding } from '@mondrian-framework/model'
import gen from 'fast-check'
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
      const encoded = payloadType.encodeWithoutValidation(payload as any)
      const result = jsonwebtoken.sign(encoded as object, secret, {
        algorithm: options?.algorithm ?? DEFAULT_HS_JWT_ALGORITHM,
      })
      return result
    },
    (value) => decodeJwt(value, payloadType, secret, options),
    (payload, options) => payloadType.validate(payload as never, options),
    (maxDepth) => types.concretise(payloadType).arbitrary(maxDepth) as gen.Arbitrary<types.Infer<T>>,
    options,
  )
}

function decodeJwt<T extends types.Type>(
  value: unknown,
  payloadType: T,
  secret: string,
  options?: JwtOptions,
): decoding.Result<types.Infer<T>> {
  if (typeof value !== 'string') {
    return decoding.fail('Invalid JWT type. String expected.', value)
  }
  try {
    const decoded = jsonwebtoken.verify(value, secret, {
      ...options,
      complete: true,
      algorithms: [options?.algorithm ?? DEFAULT_HS_JWT_ALGORITHM],
    })
    return types.concretise(payloadType).decodeWithoutValidation(decoded.payload)
  } catch {
    return decoding.fail('Invalid JWT type. Verify failed.', value)
  }
}
