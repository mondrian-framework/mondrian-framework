import { DefaultMethods } from './base'
import { types } from '../../'

/**
 * @param variants a record with the different variants, each one paired with a function that can be used to determine
 *                 wether a value belongs to that variant or not
 * @param options the {@link UnionTypeOptions options} used to define the new `UnionType`
 * @returns a new {@link UnionType `UnionType`} with the provided `variants` and `options`
 * @example Imagine you are modelling TODO
 */
export function union<Ts extends types.Types>(
  variants: Ts,
  options?: types.OptionsOf<types.UnionType<Ts>>,
): types.UnionType<Ts> {
  return new UnionTypeImpl(variants, options)
}

class UnionTypeImpl<Ts extends types.Types> extends DefaultMethods<types.UnionType<Ts>> implements types.UnionType<Ts> {
  readonly kind = types.Kind.Union
  readonly variants: Ts

  fromOptions = (options: types.OptionsOf<types.UnionType<Ts>>) => union(this.variants, options)
  getThis = () => this

  constructor(variants: Ts, options?: types.OptionsOf<types.UnionType<Ts>>) {
    super(options)
    this.variants = variants
  }
}
