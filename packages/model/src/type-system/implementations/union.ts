import { decoding, path, types, validation } from '../../'
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

  validate(value: types.Infer<types.UnionType<Ts>>, validationOptions?: validation.Options): validation.Result {
    const failureMessage =
      "I tried to validate an object that is not a union's variant. This should have been prevented by the type system"
    const variantName = Object.keys(value)[0]
    if (variantName === undefined) {
      failWithInternalError(failureMessage)
    } else {
      const variantType = this.variants[variantName]
      if (variantType === undefined) {
        failWithInternalError(failureMessage)
      } else {
        const result = types.concretise(variantType).validate(value[variantName] as never, validationOptions)
        return result.mapError((errors) => path.prependVariantToAll(errors, variantName))
      }
    }
  }

  decodeWithoutValidation(
    value: unknown,
    decodingOptions?: decoding.Options,
  ): decoding.Result<types.Infer<types.UnionType<Ts>>> {
    if (typeof value === 'object' && value) {
      const object = value as Record<string, any>
      const variantName = singleKeyFromObject(object)
      if (variantName !== undefined && Object.keys(this.variants).includes(variantName)) {
        return types
          .concretise(this.variants[variantName])
          .decodeWithoutValidation(object[variantName], decodingOptions)
          .map((value) => Object.fromEntries([[variantName, value]]) as types.Infer<types.UnionType<Ts>>)
          .mapError((errors) => path.prependVariantToAll(errors, variantName))
      }
    }
    const prettyVariants = Object.keys(this.variants).join(' | ')
    return decoding.fail(`union (${prettyVariants})`, value)
  }
}

/**
 * @param object the object from which to extract a single key
 * @returns the key of the object if it has exactly one key; otherwise, it returns `undefined`
 */
function singleKeyFromObject(object: object): string | undefined {
  const keys = Object.keys(object)
  return keys.length === 1 ? keys[0] : undefined
}
