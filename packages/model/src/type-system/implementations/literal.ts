import { types } from '../../'
import { DefaultMethods } from './base'

/**
 * @param value the literal value held by the new `LiteralType`
 * @param options the {@link LiteralTypeOptions options} used to define the new `LiteralType`
 * @returns a {@link LiteralType `LiteralType`} representing the literal type of `value`
 * @example Imagine you have to deal with HTTP requests whose HTTP version must be `"2.0"`.
 *          The version field could be modelled with a literal type to can guarantee that a request can only be built
 *          if its version is the string `"2.0"`:
 *
 *          ```ts
 *          type RequiredVersion = Infer<typeof requiredVersion>
 *          const requiredVersion = literal("2.0", {
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
}
