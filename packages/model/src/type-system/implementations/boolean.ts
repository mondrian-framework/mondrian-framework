import { decoding, types, validation } from '../../'
import { DefaultMethods } from './base'
import { JSONType } from '@mondrian-framework/utils'
import gen from 'fast-check'

/**
 * @param options the {@link types.BooleanTypeOptions} used to define the new `BooleanType`
 * @returns a {@link types.BooleanType} with the given options
 * @example Imagine you have to keep track of a flag that is used to check wether a user is an admin or not.
 *          The corresponding model could be defined like this:
 *
 *          ```ts
 *          type AdminFlag = types.Infer<typeof adminFlag>
 *          const adminFlag = types.boolean({
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

  encodeWithNoChecks(value: types.Infer<types.BooleanType>): JSONType {
    return value
  }

  validate(_value: types.Infer<types.BooleanType>, _validationOptions?: validation.Options): validation.Result {
    return validation.succeed()
  }

  decodeWithoutValidation(value: unknown, decodingOptions?: decoding.Options): decoding.Result<boolean> {
    if (value === true || value === false) {
      return decoding.succeed(value)
    } else if (decodingOptions?.typeCastingStrategy === 'tryCasting' && value === 'true') {
      return decoding.succeed(true)
    } else if (decodingOptions?.typeCastingStrategy === 'tryCasting' && value === 'false') {
      return decoding.succeed(false)
    } else if (decodingOptions?.typeCastingStrategy === 'tryCasting' && typeof value === 'number') {
      return decoding.succeed(value !== 0)
    } else {
      return decoding.fail('boolean', value)
    }
  }

  arbitrary(): gen.Arbitrary<boolean> {
    return gen.boolean()
  }
}
