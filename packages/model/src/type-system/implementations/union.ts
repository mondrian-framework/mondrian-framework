import { types } from '../../'
import { failWithInternalError } from '../../utils'
import { DefaultMethods } from './base'
import { JSONType } from '@mondrian-framework/utils'

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

  encodeWithoutValidation(value: types.Infer<types.UnionType<Ts>>): JSONType {
    const failureMessage =
      'I tried to encode an object that is not a variant as a union. This should have been prevented by the type system'
    const variantName = Object.keys(value)[0]
    if (variantName === undefined) {
      failWithInternalError(failureMessage)
    } else {
      const variantType = this.variants[variantName]
      if (variantType === undefined) {
        failWithInternalError(failureMessage)
      } else {
        const concreteVariantType = types.concretise(variantType)
        const rawVariantValue = value[variantName]
        const encoded = concreteVariantType.encodeWithoutValidation(rawVariantValue as never)
        return Object.fromEntries([[variantName, encoded]])
      }
    }
  }
}
