import { Result, success } from '../result'
import { CustomType, OptionsOf, custom } from '../type-system'
import { JSONType } from '@mondrian-framework/utils'
import { DecodingOptions } from 'src/decoder'
import { ValidationOptions } from 'src/validator'

/**
 * The type of unknown, defined as a custom type.
 */
export type UnknownType = CustomType<'unknown', UnknownOptions, unknown>

/**
 * Additional options for the Unknown CustomType
 */
export type UnknownOptions = {}

/**
 * Warning: the unknown type does not have a one-to-one conversion.
 * Eg 1: `{ date: new Date(0) }` will encode in `{ date: "1970-01-01T00:00:00.000Z" }`, the latter would be decoded in the same object, not reviving the date.
 * Eg 2: `undefined` will encode in `null`, `null` will decode in `null`.
 *
 * @param options the options used to create the new unknown custom type
 * @returns a {@link CustomType `CustomType`} representing a unknown
 */
export function unknown(options?: OptionsOf<UnknownType>): UnknownType {
  return custom('unknown', encodeUnknown, decodeUnknown, validateUnknown, options)
}

function encodeUnknown(value: unknown): JSONType {
  if (value === undefined) {
    return null
  }
  return JSON.parse(JSON.stringify(value))
}

function decodeUnknown(
  value: unknown,
  _decodingOptions: DecodingOptions,
  _options?: OptionsOf<UnknownType>,
): Result<unknown> {
  return success(value)
}

function validateUnknown(
  _value: unknown,
  _validationOptions: ValidationOptions,
  _options?: OptionsOf<UnknownType>,
): Result<true> {
  return success(true)
}
