import { decoding, model, validation } from '../..'
import { DefaultMethods } from './base'
import { JSONType } from '@mondrian-framework/utils'
import gen from 'fast-check'

/**
 * @param wrappedType the {@link model.Type} describing the item held by the new `NullableType`
 * @param options the {@link model.NullableTypeOptions} used to define the new `NullableType`
 * @returns a {@link model.NullableType} holding an item of the given type
 * @example ```ts
 *          type NullableString = model.Infer<typeof nullableString> // string | null
 *          const nullableString = model.nullable(model.string()) // or model.string().nullable()
 *
 *          const exampleNull: NullableString = null
 *          const examplePresent: NullableString = "Hello, Mondrian!"
 *          ```
 */
export function nullable<T extends model.Type>(
  wrappedType: T,
  options?: model.NullableTypeOptions,
): model.NullableType<T> {
  return new NullableTypeImpl(wrappedType, options)
}

class NullableTypeImpl<T extends model.Type>
  extends DefaultMethods<model.NullableType<T>>
  implements model.NullableType<T>
{
  readonly kind = model.Kind.Nullable
  readonly wrappedType: T

  fromOptions = (options: model.NullableTypeOptions) => nullable(this.wrappedType, options)
  getThis = () => this

  constructor(wrappedType: T, options?: model.NullableTypeOptions) {
    super(options)
    this.wrappedType = wrappedType
  }

  encodeWithNoChecks(value: null | model.Infer<T>): JSONType {
    return value === null ? null : model.concretise(this.wrappedType).encodeWithoutValidation(value as never)
  }

  validate(value: null | model.Infer<T>, validationOptions?: validation.Options | undefined): validation.Result {
    return value === null
      ? validation.succeed()
      : model.concretise(this.wrappedType).validate(value as never, validationOptions)
  }

  decodeWithoutValidation(value: unknown, decodingOptions?: decoding.Options): decoding.Result<null | model.Infer<T>> {
    const resWithoutCast =
      value === null
        ? decoding.succeed(null)
        : model
            .concretise(this.wrappedType)
            .decodeWithoutValidation(value, decodingOptions)
            .mapError((errors) => errors.map(decoding.addExpected('null')))
    if (resWithoutCast.isFailure && value === undefined && decodingOptions?.typeCastingStrategy === 'tryCasting') {
      return decoding.succeed(null)
    } else {
      return resWithoutCast
    }
  }

  arbitrary(maxDepth: number): gen.Arbitrary<null | model.Infer<T>> {
    if (maxDepth <= 0) {
      return gen.constant(null)
    } else {
      const concreteType = model.concretise(this.wrappedType)
      return gen.oneof(gen.constant(null), concreteType.arbitrary(maxDepth - 1))
    }
  }
}
