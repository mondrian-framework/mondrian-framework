import { model, decoding, validation } from '../../index'
import { forbiddenObjectFields } from '../../utils'
import { JSONType } from '@mondrian-framework/utils'
import gen from 'fast-check'

/**
 * Additional options for type {@link JsonType}.
 */
export type JsonTypeOptions = {
  /**
   * Size limit in bytes. Uncompressed.
   */
  sizeLimit?: number
}

/**
 * The type of a json, defined as a custom type.
 */
export type JsonType = model.CustomType<'json', JsonTypeOptions, JSONType>

/**
 * @param options the options used to create the new json custom type
 * @returns a {@link CustomType `CustomType`} representing a json
 */
export function json(options?: model.OptionsOf<JsonType>): JsonType {
  return model.custom({ typeName: 'json', encoder, decoder, validator, arbitrary: jsonArbitrary, options })
}

function encoder(json: JSONType): JSONType {
  return json
}

function decoder(value: unknown): decoding.Result<JSONType> {
  if (value === undefined) {
    return decoding.succeed(null)
  } else {
    return decoding.succeed(JSON.parse(JSON.stringify(value)))
  }
}

function validator(
  json: JSONType,
  _validationOptions: Required<validation.Options>,
  options?: model.OptionsOf<JsonType>,
): validation.Result {
  if (options?.sizeLimit != null) {
    const size = Buffer.byteLength(JSON.stringify(json))
    if (size > options.sizeLimit) {
      return validation.fail(`json must be maximum of ${options.sizeLimit}B`, size)
    }
  }
  return validation.succeed()
}

function jsonArbitrary(maxDepth: number): gen.Arbitrary<JSONType> {
  if (maxDepth <= 0) {
    return gen.oneof(gen.double(), gen.string(), gen.boolean(), gen.constant(null))
  } else {
    const fieldName = gen.string().filter((s) => !forbiddenObjectFields.includes(s))
    const subJson = jsonArbitrary(maxDepth - 1)
    return gen.oneof(
      gen.array(subJson),
      gen.array(gen.tuple(fieldName, gen.oneof(subJson, gen.constant(undefined)))).map(Object.fromEntries),
      gen.double(),
      gen.string(),
      gen.boolean(),
      gen.constant(null),
    )
  }
}
