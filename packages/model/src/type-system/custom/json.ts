import { model, decoding, validation } from '../../index'
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
  return model.custom(
    'json',
    (v) => v,
    (v) => (v === undefined ? decoding.succeed(null) : decoding.succeed(JSON.parse(JSON.stringify(v)))),
    (json) => {
      if (options?.sizeLimit != null) {
        const size = Buffer.byteLength(JSON.stringify(json))
        if (size > options.sizeLimit) {
          return validation.fail(`json must be maximum of ${options.sizeLimit}B`, size)
        }
      }
      return validation.succeed()
    },
    jsonArbitrary,
    options,
  )
}

function jsonArbitrary(maxDepth: number): gen.Arbitrary<JSONType> {
  if (maxDepth <= 0) {
    return gen.oneof(gen.double(), gen.string(), gen.boolean(), gen.constant(null))
  } else {
    const fieldName = gen.string().filter((s) => s !== '__proto__' && s !== 'valueOf')
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
