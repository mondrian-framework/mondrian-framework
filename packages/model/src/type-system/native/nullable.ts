import { decoding, encoding, model, validation } from '../..'
import { BaseType } from './base'
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

class NullableTypeImpl<T extends model.Type> extends BaseType<model.NullableType<T>> implements model.NullableType<T> {
  readonly kind = model.Kind.Nullable
  readonly wrappedType: T

  protected fromOptions = (options: model.NullableTypeOptions) => nullable(this.wrappedType, options)
  protected getThis = () => this

  constructor(wrappedType: T, options?: model.NullableTypeOptions) {
    super(options)
    this.wrappedType = wrappedType
  }

  protected encodeWithoutValidationInternal(
    value: null | model.Infer<T>,
    options: Required<encoding.Options>,
  ): JSONType {
    return value === null ? null : model.concretise(this.wrappedType).encodeWithoutValidation(value as never, options)
  }

  protected validateInternal(value: null | model.Infer<T>, options: Required<validation.Options>): validation.Result {
    return value === null ? validation.succeed() : model.concretise(this.wrappedType).validate(value as never, options)
  }

  protected decodeWithoutValidationInternal(
    value: unknown,
    options: Required<decoding.Options>,
  ): decoding.Result<null | model.Infer<T>> {
    const resWithoutCast =
      value === null
        ? decoding.succeed(null)
        : model
            .concretise(this.wrappedType)
            .decodeWithoutValidation(value, options)
            .mapError((errors) => errors.map(decoding.addExpected('null')))
    if (resWithoutCast.isFailure && value === undefined && options.typeCastingStrategy === 'tryCasting') {
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
