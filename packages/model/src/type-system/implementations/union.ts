import { decoding, types, validation } from '../../'
import { failWithInternalError } from '../../utils'
import { DefaultMethods } from './base'
import { JSONType } from '@mondrian-framework/utils'
import gen from 'fast-check'

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
 *          const successResponse: Response = 1
 *          const failureResponse: Response = { errorCode: 418, errorMessage: "I'm a teapot" }
 *          ```
 */
export function union<Ts extends types.Types>(variants: Ts, options?: types.UnionTypeOptions): types.UnionType<Ts> {
  return new UnionTypeImpl(variants, options)
}

class UnionTypeImpl<Ts extends types.Types> extends DefaultMethods<types.UnionType<Ts>> implements types.UnionType<Ts> {
  readonly kind = types.Kind.Union
  readonly variants: Ts

  fromOptions = (options: types.UnionTypeOptions) => union(this.variants, options)
  getThis = () => this

  constructor(variants: Ts, options?: types.UnionTypeOptions) {
    super(options)
    this.variants = variants
  }

  encodeWithNoChecks(value: types.Infer<types.UnionType<Ts>>): JSONType {
    const variantName = this.variantOwnership(value)
    const variantType = this.variants[variantName]
    if (variantType === undefined) {
      failWithInternalError(
        'I tried to encode an object that is not a variant as a union. This should have been prevented by the type system',
      )
    } else {
      const concreteVariantType = types.concretise(variantType)
      const encoded = concreteVariantType.encodeWithoutValidation(value as never)
      return encoded
    }
  }

  validate(value: types.Infer<types.UnionType<Ts>>, validationOptions?: validation.Options): validation.Result {
    const decoded = this.decodeAndTryToValidate(value, undefined, validationOptions)
    if (!decoded.isOk) {
      failWithInternalError(
        'Type system should have prevented this error in validation. This values does not match with any variant of this union.',
      )
    }
    const { validated, validationErrors } = decoded.value
    if (validated) {
      return validation.succeed()
    } else {
      return validation.failWithErrors(validationErrors)
    }
  }

  decodeWithoutValidation(
    value: unknown,
    decodingOptions?: decoding.Options,
  ): decoding.Result<types.Infer<types.UnionType<Ts>>> {
    return this.decodeAndTryToValidate(value, decodingOptions).map(({ value }) => value)
  }

  arbitrary(maxDepth: number): gen.Arbitrary<types.Infer<types.UnionType<Ts>>> {
    const variantsGenerators = Object.values(this.variants).map((variantType) =>
      types.concretise(variantType).arbitrary(maxDepth - 1),
    )
    return gen.oneof(...variantsGenerators) as gen.Arbitrary<types.Infer<types.UnionType<Ts>>>
  }

  variantOwnership(value: types.Infer<types.UnionType<Ts>>): keyof Ts & string {
    const decoded = this.decodeAndTryToValidate(value)
    if (!decoded.isOk) {
      failWithInternalError(
        'Type system should have prevented this error. This values does not match with any variant of this union.',
      )
    }
    return decoded.value.variantName as keyof Ts & string
  }

  private decodeAndTryToValidate(
    value: unknown,
    decodingOptions?: decoding.Options,
    validationOptions?: validation.Options,
  ): decoding.Result<{
    variantName: keyof Ts
    value: types.Infer<types.UnionType<Ts>>
    validated: boolean
    validationErrors: validation.Error[]
  }> {
    if (
      decodingOptions?.typeCastingStrategy === 'tryCasting' ||
      decodingOptions?.fieldStrictness === 'allowAdditionalFields'
    ) {
      //before using casting try to decode without casting in order to select the corret variant
      const resultWithNoCasting = this.decodeAndTryToValidate(value, {
        ...decodingOptions,
        typeCastingStrategy: 'expectExactTypes',
        fieldStrictness: 'expectExactFields',
      })
      if (resultWithNoCasting.isOk) {
        return resultWithNoCasting
      }
    }

    const decodingErrors: decoding.Error[] = []
    const validationErrors: validation.Error[] = []
    let potentialDecoded: { variantName: keyof Ts; value: types.Infer<types.UnionType<Ts>> } | null = null
    for (const [variantName, variantType] of Object.entries(this.variants)) {
      const concrete = types.concretise(variantType)
      const result = concrete.decodeWithoutValidation(value, decodingOptions)
      if (result.isOk) {
        //look ahead with `validate` in order to get a correct variant if possible
        const validateResult = concrete.validate(result.value as never, validationOptions)
        if (validateResult.isOk) {
          return decoding.succeed({ variantName, value: result.value, validated: true, validationErrors: [] })
        } else if (potentialDecoded === null) {
          //keep this as potential variant but it will not validate
          validationErrors.push(...validateResult.error)
          potentialDecoded = { variantName, value: result.value }
        }
      } else {
        decodingErrors.push(...result.error)
      }
    }
    if (potentialDecoded !== null) {
      //returns the non validating variant
      return decoding.succeed({ ...potentialDecoded, validated: false, validationErrors })
    }
    return decoding.failWithErrors(decodingErrors)
  }
}
