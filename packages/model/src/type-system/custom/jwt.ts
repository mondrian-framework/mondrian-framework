import { model, decoding, validation } from '../../index'
import jsonwebtoken from 'jsonwebtoken'

/**
 * The type of a jwt, defined as a custom type.
 */
export type JwtType<T extends model.Type> = model.CustomType<
  'jwt',
  JwtOptions,
  { readonly jwt: string; readonly payload: model.Infer<T> }
>

/**
 * Additional options for the Jwt CustomType
 */
export type JwtOptions = { payloadType: model.Type; algorithm: jsonwebtoken.Algorithm }

//TODO: encoding support
/**
 * This JWT represent only the payload of a JWT. It is not signed and it is not encoded.
 * Should be used only as input type.
 * @param options the options used to create the new jwt custom type
 * @returns a {@link CustomType `CustomType`} representing a jwt
 */
export function jwt<const Ts extends model.Types>(
  payloadFields: Ts,
  algorithm: jsonwebtoken.Algorithm,
  options?: model.BaseOptions,
): JwtType<model.ObjectType<model.Mutability.Immutable, Ts>> {
  const payloadType = model.object(payloadFields)
  return model.custom({
    typeName: 'jwt',
    encoder: () => {
      throw new Error('Cannot encode a jwt custom type. Use jsonwebtoken.sign instead.')
    },
    decoder: (value, decodingOptions) => decode(payloadType, value, decodingOptions),
    validator: (value, validationOptions) => validate(payloadType, value, validationOptions),
    arbitrary: () => {
      throw new Error('Cannot generate an arbitrary for a jwt custom type.')
    },
    options: { ...options, algorithm, payloadType },
  }) as JwtType<model.ObjectType<model.Mutability.Immutable, Ts>>
}

function decode<T extends model.Type>(
  fieldsType: T,
  value: unknown,
  decodingOptions: Required<decoding.Options>,
): decoding.Result<{ readonly jwt: string; readonly payload: model.Infer<T> }> {
  if (typeof value !== 'string') {
    return decoding.fail('jwt', value)
  }
  const payload = jsonwebtoken.decode(value)
  if (payload === null) {
    return decoding.fail('jwt', value)
  }
  return model
    .concretise(fieldsType)
    .decodeWithoutValidation(payload, {
      ...decodingOptions,
      typeCastingStrategy: 'expectExactTypes',
      fieldStrictness: 'allowAdditionalFields',
    })
    .map((payload) => ({
      jwt: value,
      payload,
    }))
}

function validate<T extends model.Type>(
  fieldsType: T,
  value: { readonly jwt: string; readonly payload: model.Infer<T> },
  validationOptions: Required<validation.Options>,
): validation.Result {
  return model.concretise(fieldsType).validate(value.payload as never, validationOptions)
}
