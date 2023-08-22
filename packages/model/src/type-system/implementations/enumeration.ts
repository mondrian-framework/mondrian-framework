import { types, validation } from '../../'
import { DefaultMethods } from './base'
import { JSONType } from '@mondrian-framework/utils'

/**
 * @param variants a non empty array of string values used to define the new `EnumType`'s variants
 * @param options the {@link EnumTypeOptions options} used to define the new `EnumType`
 * @returns an {@link EnumType `EnumType`} with the given `variants` and `options`
 * @example Imagine you have to deal with two kind of users - admins and normal users - their type can be modelled with
 *          an enum like this:
 *
 *          ```ts
 *          type UserKind = Infer<typeof userKind>
 *          const userKind = enumeration(["ADMIN", "NORMAL"], {
 *            name: "user_kind",
 *            description: "the kind of a user",
 *          })
 *
 *          const exampleUserKind : UserKind = "ADMIN"
 *          ```
 */
export function enumeration<const Vs extends readonly [string, ...string[]]>(
  variants: Vs,
  options?: types.OptionsOf<types.EnumType<Vs>>,
): types.EnumType<Vs> {
  return new EnumTypeImpl(variants, options)
}

class EnumTypeImpl<Vs extends readonly [string, ...string[]]>
  extends DefaultMethods<types.EnumType<Vs>>
  implements types.EnumType<Vs>
{
  readonly kind = types.Kind.Enum
  readonly variants: Vs

  fromOptions = (options: types.OptionsOf<types.EnumType<Vs>>) => enumeration(this.variants, options)
  getThis = () => this

  constructor(variants: Vs, options?: types.OptionsOf<types.EnumType<Vs>>) {
    super(options)
    this.variants = variants
  }

  encodeWithoutValidation(value: types.Infer<types.EnumType<Vs>>): JSONType {
    return value
  }

  validate(_value: types.Infer<types.EnumType<Vs>>, _validationOptions?: validation.Options): validation.Result {
    return validation.succeed()
  }
}
