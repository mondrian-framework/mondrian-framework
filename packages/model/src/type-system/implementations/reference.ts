import { DefaultMethods } from './base'
import { types } from 'src'

/**
 * @param wrappedType the {@link Type `Type`} referenced by the resulting `ReferenceType`
 * @param options the {@link ReferenceTypeOptions options} used to define the new `ReferenceType`
 * @returns a {@link ReferenceType `ReferenceType`} wrapping the given type, with the given `options`
 */
export function reference<T extends types.Type>(
  wrappedType: T,
  options?: types.OptionsOf<types.ReferenceType<T>>,
): types.ReferenceType<T> {
  return new ReferenceTypeImpl(wrappedType, options)
}

class ReferenceTypeImpl<T extends types.Type>
  extends DefaultMethods<types.ReferenceType<T>>
  implements types.ReferenceType<T>
{
  readonly kind = types.Kind.Reference
  readonly wrappedType: T

  fromOptions = (options: types.OptionsOf<types.ReferenceType<T>>) => reference(this.wrappedType, options)
  getThis = () => this

  constructor(wrappedType: T, options?: types.OptionsOf<types.ReferenceType<T>>) {
    super(options)
    this.wrappedType = wrappedType
  }
}
