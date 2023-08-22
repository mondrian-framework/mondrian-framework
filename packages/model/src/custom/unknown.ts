import { result, types, decoder, validation } from '../index'
import { JSONType } from '@mondrian-framework/utils'

/**
 * The type of unknown, defined as a custom type.
 */
export type UnknownType = types.CustomType<'unknown', UnknownOptions, unknown>

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
export function unknown(options?: types.OptionsOf<UnknownType>): UnknownType {
  return types.custom('unknown', encodeUnknown, decodeUnknown, validateUnknown, options)
}

function encodeUnknown(value: unknown): JSONType {
  if (value === undefined) {
    return null
  }
  return JSON.parse(JSON.stringify(value))
}

function decodeUnknown(
  value: unknown,
  _decodingOptions: decoder.Options,
  _options?: types.OptionsOf<UnknownType>,
): decoder.Result<unknown> {
  return decoder.succeed(value)
}

function validateUnknown(
  _value: unknown,
  _validationOptions?: validation.Options,
  _options?: types.OptionsOf<UnknownType>,
): validation.Result {
  return validation.succeed()
}
