import { model, decoding, validation } from '../../index'
import { JSONType } from '@mondrian-framework/utils'
import gen from 'fast-check'

/**
 * The type of unknown, defined as a custom type.
 */
export type UnknownType = model.CustomType<'unknown', UnknownOptions, unknown>

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
export function unknown(options?: model.OptionsOf<UnknownType>): UnknownType {
  return model.custom({ typeName: 'unknown', encoder, decoder, validator, arbitrary, options })
}

function encoder(value: unknown): JSONType {
  if (value === undefined) {
    return null
  }
  return JSON.parse(JSON.stringify(value))
}

function decoder(value: unknown): decoding.Result<unknown> {
  return decoding.succeed(value)
}

function validator(_value: unknown): validation.Result {
  return validation.succeed()
}

function arbitrary(): gen.Arbitrary<unknown> {
  return gen.jsonValue()
}
