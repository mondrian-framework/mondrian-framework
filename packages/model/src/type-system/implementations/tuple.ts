import { types } from '../../'
import { Mutability } from '../../type-system'
import { DefaultMethods } from './base'

/**
 * @param elemets the ordered {@link types.Type `Types`} describing the tuple
 * @param options the {@link types.TupleTypeOptions options} used to define the new `TupleType`
 * @returns an {@link types.TupleType `TupleType`} holding items of the given types, with the given `options`
 * @example ```ts
 *          type MyTuple = Infer<typeof myTuple>
 *          const myTuple = tuple([string(), number()], {
 *            name: "string-number pair",
 *          })
 *
 *          const t: MyTuple = ["hello", 2]
 *          ```
 */
export function tuple<T extends [types.Type, ...types.Type[]]>(
  elements: T,
  options?: types.OptionsOf<types.TupleType<'immutable', T>>,
): types.TupleType<'immutable', T> {
  return new TupleTypeImpl('immutable', elements, options)
}

/**
 * The same as {@link tuple} but the inferred tuple is not `readonly`.
 *
 * @param elemets the ordered {@link types.Type `Types`} describing the tuple
 * @param options the {@link types.TupleTypeOptions options} used to define the new `TupleType`
 * @returns an {@link types.TupleType `TupleType`} holding items of the given types, with the given `options`
 */
export function mutableTuple<T extends [types.Type, ...types.Type[]]>(
  elements: T,
  options?: types.OptionsOf<types.TupleType<'mutable', T>>,
): types.TupleType<'mutable', T> {
  return new TupleTypeImpl('mutable', elements, options)
}

class TupleTypeImpl<M extends Mutability, T extends [types.Type, ...types.Type[]]>
  extends DefaultMethods<types.TupleType<M, T>>
  implements types.TupleType<M, T>
{
  readonly kind = types.Kind.Tuple
  readonly elements: T
  readonly mutability: M

  getThis = () => this
  immutable = () => tuple(this.elements, this.options)
  mutable = () => mutableTuple(this.elements, this.options)
  fromOptions = (options: types.OptionsOf<types.TupleType<M, T>>) =>
    new TupleTypeImpl(this.mutability, this.elements, options)

  constructor(mutability: M, elements: T, options?: types.OptionsOf<types.TupleType<M, T>>) {
    super(options)
    this.elements = elements
    this.mutability = mutability
  }
}
