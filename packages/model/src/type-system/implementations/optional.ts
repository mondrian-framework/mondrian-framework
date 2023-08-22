import { types } from '../../'
import { DefaultMethods } from './base'
import { JSONType } from '@mondrian-framework/utils'

/**
 * @param wrappedType the {@link Type `Type`} describing the item held by the new `OptionalType`
 * @param options the {@link OptionalTypeOptions options} used to define the new `OptionalType`
 * @returns an {@link OptionalType `OptionalType`} holding an item of the given type, with the given `options`
 * @example ```ts
 *          type OptionalNumber = Infer<typeof stringArray>
 *          const optionalNumber = optional(number())
 *
 *          const exampleMissing: OptionalNumber = undefined
 *          const examplePresent: OptionalNumber = 42
 *          ```
 */
export function optional<const T extends types.Type>(
  wrappedType: T,
  options?: types.OptionsOf<types.OptionalType<T>>,
): types.OptionalType<T> {
  return new OptionalTypeImpl(wrappedType, options)
}

class OptionalTypeImpl<T extends types.Type>
  extends DefaultMethods<types.OptionalType<T>>
  implements types.OptionalType<T>
{
  readonly kind = types.Kind.Optional
  readonly wrappedType: T

  fromOptions = (options: types.OptionsOf<types.OptionalType<T>>) => optional(this.wrappedType, options)
  getThis = () => this

  constructor(wrappedType: T, options?: types.OptionsOf<types.OptionalType<T>>) {
    super(options)
    this.wrappedType = wrappedType
  }

  encodeWithoutValidation(value: types.Infer<types.OptionalType<T>>): JSONType {
    return value === undefined ? null : types.concretise(this.wrappedType).encodeWithoutValidation(value as never)
  }
}
