import { decoding, model, validation } from '../..'
import { DefaultMethods } from './base'
import { JSONType } from '@mondrian-framework/utils'
import gen from 'fast-check'

/**
 * @param options the {@link model.StringTypeOptions} used to define the new `StringType`
 * @returns a {@link model.StringType} with the given `options`
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
export function string(options?: model.StringTypeOptions): model.StringType {
  return new StringTypeImpl(options)
}

class StringTypeImpl extends DefaultMethods<model.StringType> implements model.StringType {
  readonly kind = model.Kind.String
  private readonly validator: validation.Validator<string>

  fromOptions = string
  getThis = () => this

  constructor(options?: model.StringTypeOptions) {
    super(options)
    const { minLength, maxLength, regex } = options ?? {}
    if (minLength && maxLength && minLength > maxLength) {
      throw new Error(
        `String type's minimum length (${minLength}) should be lower than its maximum length ${maxLength}`,
      )
    } else if (minLength != null && !Number.isInteger(minLength)) {
      throw new Error(`The minimum length (${minLength}) must be an integer`)
    } else if (maxLength != null && !Number.isInteger(maxLength)) {
      throw new Error(`The maximum length (${maxLength}) must be an integer`)
    } else if (minLength != null && minLength < 0) {
      throw new Error(`The minimum length (${minLength}) cannot be negative`)
    } else if (maxLength != null && maxLength < 0) {
      throw new Error(`The maximum length (${maxLength}) cannot be negative`)
    }

    this.validator = new validation.Validator(
      //prettier-ignore
      {
        ...( maxLength != null ? { [`string longer than max length (${maxLength})`]: (value) => value.length > maxLength } : {}),
        ...( minLength != null ? {[`string shorter than min length (${minLength})`]: (value) => value.length < minLength } : {}),
        ...( regex ? {[`string regex mismatch (${regex.source})`]: (value) => !regex.test(value) } : {}),
      },
    )
  }

  encodeWithoutValidationInternal(value: model.Infer<model.StringType>): JSONType {
    return value
  }

  validateInternal(value: model.Infer<model.StringType>, options: Required<validation.Options>): validation.Result {
    return this.validator.apply(value, options)
  }

  decodeWithoutValidationInternal(
    value: unknown,
    options: Required<decoding.Options>,
  ): decoding.Result<model.Infer<model.StringType>> {
    if (typeof value === 'string') {
      return decoding.succeed(value)
    } else if (options.typeCastingStrategy === 'tryCasting' && typeof value === 'number') {
      return decoding.succeed(value.toString())
    } else if (options.typeCastingStrategy === 'tryCasting' && typeof value === 'boolean') {
      return decoding.succeed(value.toString())
    } else {
      return decoding.fail('string', value)
    }
  }

  arbitrary(): gen.Arbitrary<string> {
    if (!this.options) {
      return gen.string()
    } else {
      const { regex, minLength, maxLength } = this.options
      if ((regex && minLength != null) || (regex && maxLength != null)) {
        const message = 'I cannot generate values from string types that have both a regex and min/max length defined'
        throw new Error(message)
      } else {
        return !regex ? gen.string({ maxLength, minLength }) : gen.stringMatching(regex)
      }
    }
  }
}
