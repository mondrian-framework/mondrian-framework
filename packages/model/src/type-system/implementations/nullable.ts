import { decoding, types, validation } from '../../'
import { DefaultMethods } from './base'
import { JSONType } from '@mondrian-framework/utils'
import gen from 'fast-check'

/**
 * @param wrappedType the {@link types.Type} describing the item held by the new `NullableType`
 * @param options the {@link types.NullableTypeOptions} used to define the new `NullableType`
 * @returns a {@link types.NullableType} holding an item of the given type
 * @example ```ts
 *          type NullableString = types.Infer<typeof nullableString>
 *          const nullableString = types.nullable(types.string()) // or types.string().nullable()
 *
 *          const exampleNull: NullableString = null
 *          const examplePresent: NullableString = "Hello, Mondrian!"
 *          ```
 */
export function nullable<T extends types.Type>(
  wrappedType: T,
  options?: types.OptionsOf<types.NullableType<T>>,
): types.NullableType<T> {
  return new NullableTypeImpl(wrappedType, options)
}

class NullableTypeImpl<T extends types.Type>
  extends DefaultMethods<types.NullableType<T>>
  implements types.NullableType<T>
{
  readonly kind = types.Kind.Nullable
  readonly wrappedType: T

  fromOptions = (options: types.OptionsOf<types.NullableType<T>>) => nullable(this.wrappedType, options)
  getThis = () => this

  constructor(wrappedType: T, options?: types.OptionsOf<types.NullableType<T>>) {
    super(options)
    this.wrappedType = wrappedType
  }

  encodeWithNoChecks(value: null | types.Infer<T>): JSONType {
    return value === null ? null : types.concretise(this.wrappedType).encodeWithoutValidation(value as never)
  }

  validate(value: null | types.Infer<T>, validationOptions?: validation.Options | undefined): validation.Result {
    return value === null
      ? validation.succeed()
      : types.concretise(this.wrappedType).validate(value as never, validationOptions)
  }

  decodeWithoutValidation(value: unknown, decodingOptions?: decoding.Options): decoding.Result<null | types.Infer<T>> {
    if (value === null) {
      return decoding.succeed(null)
    } else if (decodingOptions?.typeCastingStrategy === 'tryCasting' && value === undefined) {
      return decoding.succeed(null)
    } else {
      return types
        .concretise(this.wrappedType)
        .decodeWithoutValidation(value, decodingOptions)
        .mapError((errors) => errors.map(decoding.addExpected('null')))
    }
  }

  arbitrary(maxDepth: number): gen.Arbitrary<null | types.Infer<T>> {
    if (maxDepth <= 0) {
      return gen.constant(null)
    } else {
      const concreteType = types.concretise(this.wrappedType)
      return gen.oneof(gen.constant(null), concreteType.arbitrary(maxDepth - 1))
    }
  }
}
