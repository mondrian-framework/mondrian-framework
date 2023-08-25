import { types, decoding, validation } from '../../'
import { DefaultMethods } from './base'
import { JSONType } from '@mondrian-framework/utils'

/**
 * @param options the {@link NumberTypeOptions options} used to define the new `NumberType`
 * @throws if the `multipleOf` field of `options` is less than or equal to 0
 * @returns a {@link NumberType `NumberType`} with the given `options`
 * @example Imagine you have to deal with the measurements coming from a thermometer: those values can be thought of as
 *          floating point numbers. A model for such a data type could be defined like this:
 *
 *          ```ts
 *          type Measurement = Infer<typeof measurement>
 *          const measurement = number({
 *            name: "measurement",
 *            description: "a measurement coming from a thermometer",
 *          })
 *
 *          const exampleMeasurement: Measurement = 28.2
 *          ```
 */
export function number(options?: types.OptionsOf<types.NumberType>): types.NumberType {
  return new NumberTypeImpl(options)
}

/**
 * @param options the {@link types.NumberTypeOptions} used to define the new `NumberType`
 * @returns a {@link types.NumberType} where the `isInteger` flag is set to true
 * @example Imagine you have to deal with the age of a users: it can be thought of as an integer number that can never
 *          be lower than zero. A model for such a data type could be defined like this:
 *
 *          ```ts
 *          type Age = types.Infer<typeof age>
 *          const age = types.integer({
 *            name: "age",
 *            description: "an age that is never negative",
 *            inclusiveMinimum: 0,
 *          })
 *
 *          const exampleAge: Age = 24
 *           ```
 */
export function integer(options?: types.OptionsOf<types.NumberType>): types.NumberType {
  return number({ ...options, isInteger: true })
}

class NumberTypeImpl extends DefaultMethods<types.NumberType> implements types.NumberType {
  readonly kind = types.Kind.Number

  getThis = () => this
  fromOptions = number

  constructor(options?: types.OptionsOf<types.NumberType>) {
    super(options)
    const minimum = options?.minimum
    const exclusiveMinimum = options?.exclusiveMinimum
    const maximum = options?.maximum
    const exclusiveMaximum = options?.exclusiveMaximum
    const lowerBound = minimum && exclusiveMinimum ? Math.max(minimum, exclusiveMinimum) : minimum ?? exclusiveMinimum
    const upperBound = maximum && exclusiveMaximum ? Math.min(maximum, exclusiveMaximum) : maximum ?? exclusiveMaximum
    const exclude = lowerBound === exclusiveMinimum || upperBound === exclusiveMaximum
    if (lowerBound && upperBound) {
      if (exclude && lowerBound === upperBound) {
        throw new Error(
          `Lower bound (${lowerBound}) cannot be equal to upper bound (${upperBound})\nmin ${minimum}\nemin ${exclusiveMinimum}\nmax ${maximum}\nemax ${exclusiveMaximum}`,
        )
      }
      if (lowerBound > upperBound) {
        throw new Error(`Lower bound (${lowerBound}) must be lower or equal to the upper bound (${upperBound})`)
      }
    }
  }

  encodeWithNoChecks(value: types.Infer<types.NumberType>): JSONType {
    return value
  }

  validate(value: types.Infer<types.NumberType>, _validationOptions?: validation.Options): validation.Result {
    if (this.options === undefined) {
      return validation.succeed()
    }
    const { maximum, minimum, exclusiveMaximum, exclusiveMinimum, isInteger } = this.options
    if (maximum && !(value <= maximum)) {
      return validation.fail(`number must be less than or equal to ${maximum}`, value)
    } else if (exclusiveMaximum && !(value < exclusiveMaximum)) {
      return validation.fail(`number must be less than to ${exclusiveMaximum}`, value)
    } else if (minimum && !(value >= minimum)) {
      return validation.fail(`number must be greater than or equal to ${minimum}`, value)
    } else if (exclusiveMinimum && !(value > exclusiveMinimum)) {
      return validation.fail(`number must be greater than ${exclusiveMinimum}`, value)
    } else if (isInteger && !Number.isInteger(value)) {
      return validation.fail(`number must be an integer`, value)
    } else {
      return validation.succeed()
    }
  }

  decodeWithoutValidation(
    value: unknown,
    decodingOptions?: decoding.Options,
  ): decoding.Result<types.Infer<types.NumberType>> {
    if (typeof value === 'number') {
      return decoding.succeed(value)
    } else if (decodingOptions?.typeCastingStrategy === 'tryCasting' && typeof value === 'string') {
      return numberFromString(value)
    } else {
      return decoding.fail('number', value)
    }
  }
}

function numberFromString(string: string): decoding.Result<number> {
  const number = Number(string)
  if (Number.isNaN(number)) {
    return decoding.fail('number', string)
  } else {
    return decoding.succeed(number)
  }
}
