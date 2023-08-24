import { decoding, types, validation } from '../../'
import { DefaultMethods } from './base'
import { JSONType } from '@mondrian-framework/utils'

/**
 * @param options the {@link types.StringTypeOptions} used to define the new `StringType`
 * @returns a {@link types.StringType} with the given `options`
 * @example Imagine you have to deal with string usernames that can never be empty.
 *          A model for such username could be defined like this:
 *
 *          ```ts
 *          type Username = Infer<typeof username>
 *          const username = string({
 *            name: "username",
 *            description: "a username that is never empty",
 *            minLength: 1,
 *          })
 *
 *          const exampleUsername: Username = "my_cool_username"
 *          ```
 */
export function string(options?: types.OptionsOf<types.StringType>): types.StringType {
  return new StringTypeImpl(options)
}

class StringTypeImpl extends DefaultMethods<types.StringType> implements types.StringType {
  readonly kind = types.Kind.String

  fromOptions = string
  getThis = () => this

  constructor(options?: types.OptionsOf<types.StringType>) {
    super(options)
    const minLength = options?.minLength
    const maxLength = options?.maxLength
    if (minLength && maxLength && minLength > maxLength) {
      throw new Error(
        `String type's minimum length (${minLength}) should be lower than its maximum length ${maxLength}`,
      )
    } else if (minLength && !Number.isInteger(minLength)) {
      throw new Error(`The minimum length (${minLength}) must be an integer`)
    } else if (maxLength && !Number.isInteger(maxLength)) {
      throw new Error(`The maximum length (${maxLength}) must be an integer`)
    } else if (minLength && minLength < 0) {
      throw new Error(`The minimum length (${minLength}) cannot be negative`)
    } else if (maxLength && maxLength < 0) {
      throw new Error(`The maximum length (${maxLength}) cannot be negative`)
    }
  }

  encodeWithoutValidation(value: types.Infer<types.StringType>): JSONType {
    return value
  }

  validate(value: types.Infer<types.StringType>, _validationOptions?: validation.Options): validation.Result {
    if (this.options === undefined) {
      return validation.succeed()
    }
    const { regex, maxLength, minLength } = this.options
    if (maxLength && value.length > maxLength) {
      return validation.fail(`string longer than max length (${maxLength})`, value)
    }
    if (minLength && value.length < minLength) {
      return validation.fail(`string shorter than min length (${minLength})`, value)
    }
    if (regex && !regex.test(value)) {
      return validation.fail(`string regex mismatch (${regex.source})`, value)
    }
    return validation.succeed()
  }

  decodeWithoutValidation(
    value: unknown,
    decodingOptions?: decoding.Options,
  ): decoding.Result<types.Infer<types.StringType>> {
    if (typeof value === 'string') {
      return decoding.succeed(value)
    } else if (decodingOptions?.typeCastingStrategy === 'tryCasting' && typeof value === 'number') {
      return decoding.succeed(value.toString())
    } else if (decodingOptions?.typeCastingStrategy === 'tryCasting' && typeof value === 'boolean') {
      return decoding.succeed(value.toString())
    } else {
      return decoding.fail('string', value)
    }
  }
}
