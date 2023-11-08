import { decoding, types, validation } from '../../'
import { DefaultMethods } from './base'
import { JSONType } from '@mondrian-framework/utils'
import gen from 'fast-check'

/**
 * @param wrappedType the {@link types.Type} describing the item held by the new `OptionalType`
 * @param options the {@link types.OptionalTypeOptions} used to define the new `OptionalType`
 * @returns an {@link types.OptionalType} holding an item of the given type
 * @example ```ts
 *          type OptionalNumber = types.Infer<typeof stringArray>
 *          const optionalNumber = types.optional(types.number()) // types.number().optional()
 *
 *          const exampleMissing: OptionalNumber = undefined
 *          const examplePresent: OptionalNumber = 42
 *          ```
 */
export function optional<const T extends types.Type>(
  wrappedType: T,
  options?: types.OptionalTypeOptions,
): types.OptionalType<T> {
  return new OptionalTypeImpl(wrappedType, options)
}

class OptionalTypeImpl<T extends types.Type>
  extends DefaultMethods<types.OptionalType<T>>
  implements types.OptionalType<T>
{
  readonly kind = types.Kind.Optional
  readonly wrappedType: T

  fromOptions = (options: types.OptionalTypeOptions) => optional(this.wrappedType, options)
  getThis = () => this

  constructor(wrappedType: T, options?: types.OptionalTypeOptions) {
    super(options)
    this.wrappedType = wrappedType
  }

  encodeWithNoChecks(value: undefined | types.Infer<T>): JSONType {
    return value === undefined ? null : types.concretise(this.wrappedType).encodeWithoutValidation(value as never)
  }

  validate(value: undefined | types.Infer<T>, validationOptions?: validation.Options): validation.Result {
    return value === undefined
      ? validation.succeed()
      : types.concretise(this.wrappedType).validate(value as never, validationOptions)
  }

  decodeWithoutValidation(
    value: unknown,
    decodingOptions?: decoding.Options,
  ): decoding.Result<undefined | types.Infer<T>> {
    return value === undefined || value === null
      ? decoding.succeed(undefined)
      : types
          .concretise(this.wrappedType)
          .decodeWithoutValidation(value, decodingOptions)
          .mapError((errors) => errors.map(decoding.addExpected('undefined')))
  }

  arbitrary(maxDepth: number): gen.Arbitrary<undefined | types.Infer<T>> {
    if (maxDepth <= 0) {
      return gen.constant(undefined)
    } else {
      const concreteType = types.concretise(this.wrappedType)
      return gen.oneof(gen.constant(undefined), concreteType.arbitrary(maxDepth - 1))
    }
  }
}
