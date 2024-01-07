import { decoding, encoding, model, validation } from '../..'
import { BaseType } from './base'
import { JSONType } from '@mondrian-framework/utils'
import gen from 'fast-check'

/**
 * @param wrappedType the {@link model.Type} describing the item held by the new `OptionalType`
 * @param options the {@link model.OptionalTypeOptions} used to define the new `OptionalType`
 * @returns an {@link model.OptionalType} holding an item of the given type
 * @example ```ts
 *          type OptionalNumber = model.Infer<typeof optionalNumber> // number | undefined
 *          const optionalNumber = model.optional(model.number()) // model.number().optional()
 *
 *          const exampleMissing: OptionalNumber = undefined
 *          const examplePresent: OptionalNumber = 42
 *          ```
 */
export function optional<const T extends model.Type>(
  wrappedType: T,
  options?: model.OptionalTypeOptions,
): model.OptionalType<T> {
  return new OptionalTypeImpl(wrappedType, options)
}

class OptionalTypeImpl<T extends model.Type> extends BaseType<model.OptionalType<T>> implements model.OptionalType<T> {
  readonly kind = model.Kind.Optional
  readonly wrappedType: T

  protected fromOptions = (options: model.OptionalTypeOptions) => optional(this.wrappedType, options)
  protected getThis = () => this

  constructor(wrappedType: T, options?: model.OptionalTypeOptions) {
    super(options)
    this.wrappedType = wrappedType
  }

  protected encodeWithoutValidationInternal(
    value: undefined | model.Infer<T>,
    options: Required<encoding.Options>,
  ): JSONType {
    if (value === undefined) {
      return null
    }
    return model.concretise(this.wrappedType).encodeWithoutValidation(value as never, options)
  }

  protected validateInternal(
    value: undefined | model.Infer<T>,
    options: Required<validation.Options>,
  ): validation.Result {
    return value === undefined
      ? validation.succeed()
      : model.concretise(this.wrappedType).validate(value as never, options)
  }

  protected decodeWithoutValidationInternal(
    value: unknown,
    options: Required<decoding.Options>,
  ): decoding.Result<undefined | model.Infer<T>> {
    const resWithoutCast =
      value === undefined
        ? decoding.succeed(undefined)
        : model
            .concretise(this.wrappedType)
            .decodeWithoutValidation(value, options)
            .mapError((errors) =>
              errors.map((error) =>
                error.expected !== 'undefined' ? decoding.addExpected('undefined')(error) : error,
              ),
            )
    if (resWithoutCast.isFailure && value === null) {
      //TODO: only when casting?
      return decoding.succeed(undefined)
    } else {
      return resWithoutCast
    }
  }

  arbitrary(maxDepth: number): gen.Arbitrary<undefined | model.Infer<T>> {
    if (maxDepth <= 0) {
      return gen.constant(undefined)
    } else {
      const concreteType = model.concretise(this.wrappedType)
      return gen.oneof(gen.constant(undefined), concreteType.arbitrary(maxDepth - 1))
    }
  }
}
