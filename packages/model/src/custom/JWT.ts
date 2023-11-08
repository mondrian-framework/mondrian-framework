import { decoding, model } from '..'
import gen from 'fast-check'
import jsonwebtoken from 'jsonwebtoken'

type JwtOptions = { algorithm: 'HS256' | 'HS384' | 'HS512' } & Omit<
  jsonwebtoken.VerifyOptions,
  'algorithms' | 'complete'
>

const DEFAULT_HS_JWT_ALGORITHM = 'HS256'

export type JWTType<T extends model.ObjectType<model.Mutability, model.Types>, Name extends string> = model.CustomType<
  `${Name}-jwt`,
  JwtOptions,
  model.Infer<T>
>

export function jwt<const T extends model.ObjectType<any, any>, const Name extends string>(
  name: Name,
  payloadType: T,
  secret: string,
  options?: model.BaseOptions & JwtOptions,
): JWTType<T, Name> {
  return model.custom(
    `${name}-jwt`,
    (payload) => {
      const encoded = payloadType.encodeWithoutValidation(payload as any)
      const result = jsonwebtoken.sign(encoded as object, secret, {
        algorithm: options?.algorithm ?? DEFAULT_HS_JWT_ALGORITHM,
      })
      return result
    },
    (value) => decodeJwt(value, payloadType, secret, options),
    (payload, options) =>
      payloadType.validate(payload as model.Infer<model.ObjectType<model.Mutability, model.Types>>, options),
    (maxDepth) => model.concretise(payloadType).arbitrary(maxDepth) as gen.Arbitrary<model.Infer<T>>,
    options,
  )
}

function decodeJwt<T extends model.Type>(
  value: unknown,
  payloadType: T,
  secret: string,
  options?: JwtOptions,
): decoding.Result<model.Infer<T>> {
  if (typeof value !== 'string') {
    return decoding.fail('Invalid JWT type. String expected.', value)
  }
  try {
    const decoded = jsonwebtoken.verify(value, secret, {
      ...options,
      complete: true,
      algorithms: [options?.algorithm ?? DEFAULT_HS_JWT_ALGORITHM],
    })
    return model.concretise(payloadType).decodeWithoutValidation(decoded.payload)
  } catch {
    return decoding.fail('Invalid JWT type. Verify failed.', value)
  }
}
