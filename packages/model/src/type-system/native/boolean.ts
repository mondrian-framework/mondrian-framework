import { decoding, model, validation } from '../..'
import { BaseType } from './base'
import { JSONType } from '@mondrian-framework/utils'
import gen from 'fast-check'

/**
 * @param options the {@link model.BooleanTypeOptions} used to define the new `BooleanType`
 * @returns a {@link model.BooleanType} with the given options
 * @example Imagine you have to keep track of a flag that is used to check wether a user is an admin or not.
 *          The corresponding model could be defined like this:
 *
 *          ```ts
 *          type AdminFlag = model.Infer<typeof adminFlag>
 *          const adminFlag = model.boolean({
 *            name: "isAdmin",
 *            description: "a flag that is True if the user is also an admin",
 *          })
 *
 *          const exampleAdminFlag: AdminFlag = true
 *          ```
 */
export function boolean(options?: model.BooleanTypeOptions): model.BooleanType {
  return new BooleanTypeImpl(options)
}

class BooleanTypeImpl extends BaseType<model.BooleanType> implements model.BooleanType {
  readonly kind = model.Kind.Boolean

  protected getThis = () => this
  protected fromOptions = boolean

  constructor(options?: model.BooleanTypeOptions) {
    super(options)
  }

  protected encodeWithoutValidationInternal(value: boolean): JSONType {
    return value
  }

  protected validateInternal(_value: boolean): validation.Result {
    return validation.succeed()
  }

  protected decodeWithoutValidationInternal(
    value: unknown,
    options: Required<decoding.Options>,
  ): decoding.Result<boolean> {
    if (value === true || value === false) {
      return decoding.succeed(value)
    } else if (options.typeCastingStrategy === 'tryCasting') {
      if (value === 'true') {
        return decoding.succeed(true)
      } else if (value === 'false') {
        return decoding.succeed(false)
      } else if (typeof value === 'number') {
        return decoding.succeed(value !== 0)
      }
    }
    return decoding.fail('boolean', value)
  }

  arbitraryInternal(): gen.Arbitrary<boolean> {
    return gen.boolean()
  }
}
