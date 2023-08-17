import { DefaultMethods } from './base'
import { types } from '../../'

/**
 * @param wrappedType the {@link types.Type `Type`} describing the items held by the new `ArrayType`
 * @param options the {@link types.ArrayTypeOptions options} used to define the new `ArrayType`
 * @returns an {@link types.ArrayType `ArrayType`} holding items of the given type, with the given `options`
 * @example ```ts
 *          type StringArray = Infer<typeof stringArray>
 *          const stringArray = array(string(), {
 *            name: "a list of at most 3 strings",
 *            maxItems: 3,
 *          })
 *
 *          const strings: StringArray = ["hello", " ", "world!"]
 *          ```
 */
export function array<T extends types.Type>(
  wrappedType: T,
  options?: types.OptionsOf<types.ArrayType<'immutable', T>>,
): types.ArrayType<'immutable', T> {
  return new ArrayTypeImpl('immutable', wrappedType, options)
}

/**
 * The same as the {@link array `array`} function, but the inferred array is `readonly`.
 *
 * @param wrappedType the {@link types.Type `Type`} describing the items held by the new `ArrayType`
 * @param options the {@link types.ArrayTypeOptions options} used to define the new `ArrayType`
 * @returns an {@link types.ArrayType `ArrayType`} holding items of the given type, with the given `options`
 */
export function mutableArray<T extends types.Type>(
  wrappedType: T,
  options?: types.OptionsOf<types.ArrayType<'mutable', T>>,
): types.ArrayType<'mutable', T> {
  return new ArrayTypeImpl('mutable', wrappedType, options)
}

class ArrayTypeImpl<M extends types.Mutability, T extends types.Type>
  extends DefaultMethods<types.ArrayType<M, T>>
  implements types.ArrayType<M, T>
{
  readonly kind = types.Kind.Array
  readonly wrappedType: T
  readonly mutability: M

  getThis = () => this
  immutable = () => array(this.wrappedType, this.options)
  mutable = () => mutableArray(this.wrappedType, this.options)
  fromOptions = (options: types.OptionsOf<types.ArrayType<M, T>>) =>
    new ArrayTypeImpl(this.mutability, this.wrappedType, options)

  constructor(mutability: M, wrappedType: T, options?: types.OptionsOf<types.ArrayType<M, T>>) {
    super(options)
    this.wrappedType = wrappedType
    this.mutability = mutability
  }
}
