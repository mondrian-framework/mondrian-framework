import { types } from '../../'
import { DefaultMethods } from './base'
import { JSONType } from '@mondrian-framework/utils'

/**
 * @param options the {@link BooleanTypeOptions options} used to define the new `BooleanType`
 * @returns a {@link BooleanType `BooleanType`} with the given `options`
 * @example Imagine you have to keep track of a flag that is used to check wether a user is an admin or not.
 *          The corresponding model could be defined like this:
 *
 *          ```ts
 *          type AdminFlag = Infer<typeof adminFlag>
 *          const adminFlag: BooleanType = boolean({
 *            name: "isAdmin",
 *            description: "a flag that is True if the user is also an admin",
 *          })
 *
 *          const exampleAdminFlag: AdminFlag = true
 *          ```
 */
export function boolean(options?: types.OptionsOf<types.BooleanType>): types.BooleanType {
  return new BooleanTypeImpl(options)
}

class BooleanTypeImpl extends DefaultMethods<types.BooleanType> implements types.BooleanType {
  readonly kind = types.Kind.Boolean

  getThis = () => this
  fromOptions = boolean

  constructor(options?: types.OptionsOf<types.NumberType>) {
    super(options)
  }

  encodeWithoutValidation(value: types.Infer<types.BooleanType>): JSONType {
    return value
  }
}
