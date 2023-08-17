import { DefaultMethods } from './base'
import { types } from '../../'

/**
 * @param wrappedType the {@link Type `Type`} describing the item held by the new `NullableType`
 * @param options the {@link NullableTypeOptions options} used to define the new `NullableType`
 * @returns a {@link NullableType `NullableType`} holding an item of the given type, with the given `options`
 * @example ```ts
 *          type NullableString = Infer<typeof nullableString>
 *          const nullableString = nullable(string())
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
}
