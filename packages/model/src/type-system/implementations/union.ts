import { decoding, types, validation } from '../../'
import { failWithInternalError, prependVariantToAll } from '../../utils'
import { DefaultMethods } from './base'
import { JSONType } from '@mondrian-framework/utils'

/**
 * @param variants a record with the different variants of the union
 * @param options the {@link types.UnionTypeOptions} used to define the new `UnionType`
 * @returns a new {@link types.UnionType} with the provided variants
 * @example Imagine you are modelling the response a server might send a client following a request.
 *          The response may be successfull and hold a value (let's say it's just an integer value
 *          for simplicity) or be an error and hold an error code and an additional string to
 *          explain what went wrong.
 *
 *          This type could be modelled as follows:
 *          ```ts
 *          type Respose = types.Infer<typeof response>
 *          const response = types.union({
 *            success: types.number(),
 *            failure: types.object({
 *              errorCode: types.number(),
 *              errorMessage: types.string(),
 *            })
 *          })
 *
 *          const successResponse: Response = { success: 1 }
 *          const failureResponse: Response = { failure: { errorCode: 418, errorMessage: "I'm a teapot" } }
 *          ```
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
        return result.mapError((errors) => prependVariantToAll(errors, variantName))
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
          .mapError((errors) => prependVariantToAll(errors, variantName))
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
