import { model, decoding, validation } from '../..'
import { BaseType } from './base'
import { JSONType } from '@mondrian-framework/utils'
import gen from 'fast-check'

/**
 * @param value the literal value held by the new `LiteralType`
 * @param options the {@link model.LiteralTypeOptions} used to define the new `LiteralType`
 * @returns a {@link model.LiteralType} representing the literal type of `value`
 * @example Imagine you have to deal with HTTP requests whose HTTP version must be `"2.0"`.
 *          The version field could be modelled with a literal type to can guarantee that a request can only be built
 *          if its version is the string `"2.0"`:
 *
 *          ```ts
 *          type RequiredVersion = model.Infer<typeof requiredVersion>
 *          const requiredVersion = model.literal("2.0", {
 *            name: "requiredVersion",
 *            description: "the required version for the HTTPS requests",
 *          })
 *
 *          const version: RequiredVersion = "2.0"
 *          ```
 */
export function literal<const L extends number | string | boolean>(
  literalValue: L,
  options?: model.LiteralTypeOptions,
): model.LiteralType<L> {
  return new LiteralTypeImpl(literalValue, options)
}

class LiteralTypeImpl<L extends number | string | boolean | null | undefined>
  extends BaseType<model.LiteralType<L>>
  implements model.LiteralType<L>
{
  readonly kind = model.Kind.Literal
  readonly literalValue: L

  protected fromOptions = (options: model.LiteralTypeOptions) => new LiteralTypeImpl(this.literalValue, options)
  protected getThis = () => this

  constructor(literalValue: L, options?: model.LiteralTypeOptions) {
    super(options)
    this.literalValue = literalValue
  }

  protected encodeWithoutValidationInternal(_value: L): JSONType {
    if (this.literalValue === undefined) {
      return null
    }
    return this.literalValue
  }

  protected validateInternal(_value: L): validation.Result {
    return validation.succeed()
  }

  protected decodeWithoutValidationInternal(value: unknown, options: Required<decoding.Options>): decoding.Result<L> {
    if (this.options?.allowUndefinedValue && value === undefined) {
      return decoding.succeed(this.literalValue)
    }
    if (value === this.literalValue) {
      return decoding.succeed(this.literalValue)
    } else if (options.typeCastingStrategy === 'tryCasting' && this.literalValue === null && value === 'null') {
      return decoding.succeed(this.literalValue)
    } else if (this.literalValue === undefined && value === null) {
      return decoding.succeed(this.literalValue)
    } else {
      return decoding.fail(
        this.literalValue === undefined
          ? 'undefined'
          : this.literalValue === null
            ? 'null'
            : `literal (${this.literalValue})`,
        value,
      )
    }
  }

  arbitraryInternal(): gen.Arbitrary<L> {
    return gen.constant(this.literalValue)
  }
}

export const nullLiteral = (options?: model.LiteralTypeOptions): model.LiteralType<null> =>
  new LiteralTypeImpl(null, options)

export const undefinedLiteral = (options?: model.LiteralTypeOptions): model.LiteralType<undefined> =>
  new LiteralTypeImpl(undefined, options)
