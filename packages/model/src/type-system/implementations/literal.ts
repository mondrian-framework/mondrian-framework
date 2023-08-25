import { types, decoding, validation } from '../../'
import { DefaultMethods } from './base'
import { JSONType } from '@mondrian-framework/utils'

/**
 * @param value the literal value held by the new `LiteralType`
 * @param options the {@link types.LiteralTypeOptions} used to define the new `LiteralType`
 * @returns a {@link types.LiteralType} representing the literal type of `value`
 * @example Imagine you have to deal with HTTP requests whose HTTP version must be `"2.0"`.
 *          The version field could be modelled with a literal type to can guarantee that a request can only be built
 *          if its version is the string `"2.0"`:
 *
 *          ```ts
 *          type RequiredVersion = types.Infer<typeof requiredVersion>
 *          const requiredVersion = types.literal("2.0", {
 *            name: "requiredVersion",
 *            description: "the required version for the HTTPS requests",
 *          })
 *
 *          const version: RequiredVersion = "2.0"
 *          ```
 */
export function literal<const L extends number | string | boolean | null>(
  literalValue: L,
  options?: types.OptionsOf<types.LiteralType<L>>,
): types.LiteralType<L> {
  return new LiteralTypeImpl(literalValue, options)
}

class LiteralTypeImpl<L extends number | string | boolean | null>
  extends DefaultMethods<types.LiteralType<L>>
  implements types.LiteralType<L>
{
  readonly kind = types.Kind.Literal
  readonly literalValue: L

  fromOptions = (options: types.OptionsOf<types.LiteralType<L>>) => literal(this.literalValue, options)
  getThis = () => this

  constructor(literalValue: L, options?: types.OptionsOf<types.LiteralType<L>>) {
    super(options)
    this.literalValue = literalValue
  }

  encodeWithNoChecks(value: types.Infer<types.LiteralType<L>>): JSONType {
    return value
  }

  validate(_value: L, _validationOptions?: validation.Options): validation.Result {
    return validation.succeed()
  }

  decodeWithoutValidation(
    value: unknown,
    decodingOptions?: decoding.Options,
  ): decoding.Result<types.Infer<types.LiteralType<L>>> {
    if (value === this.literalValue) {
      return decoding.succeed(this.literalValue)
    } else if (
      decodingOptions?.typeCastingStrategy === 'tryCasting' &&
      this.literalValue === null &&
      value === 'null'
    ) {
      return decoding.succeed(this.literalValue)
    } else {
      return decoding.fail(`literal (${this.literalValue})`, value)
    }
  }
}
