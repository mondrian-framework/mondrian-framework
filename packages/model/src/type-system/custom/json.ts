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
  const nonFinite = findNonFiniteNumber(json)
  if (nonFinite !== undefined) {
    return validation.fail('json cannot contain non-finite numbers', nonFinite)
  }
  if (options?.sizeLimit != null) {
    const size = Buffer.byteLength(JSON.stringify(json))
    if (size > options.sizeLimit) {
      return validation.fail(`json must be maximum of ${options.sizeLimit}B`, size)
    }
  }
  return validation.succeed()
}

/**
 * NaN and ±Infinity are not representable in JSON: `JSON.stringify` turns them into `null`,
 * silently corrupting the value, so they are rejected by validation instead.
 */
function findNonFiniteNumber(value: JSONType): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? undefined : value
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findNonFiniteNumber(item)
      if (found !== undefined) {
        return found
      }
    }
  } else if (typeof value === 'object' && value !== null) {
    for (const item of Object.values(value)) {
      if (item !== undefined) {
        const found = findNonFiniteNumber(item)
        if (found !== undefined) {
          return found
        }
      }
    }
  }
  return undefined
}

// Only JSON-representable numbers: no NaN/±Infinity (rejected by the validator) and no -0,
// which JSON round-trips to 0 (the decoder would normalize it, breaking encode∘decode identity).
const jsonNumber = gen.double({ noNaN: true, noDefaultInfinity: true }).map((n) => (Object.is(n, -0) ? 0 : n))

function jsonArbitrary(maxDepth: number): gen.Arbitrary<JSONType> {
  if (maxDepth <= 0) {
    return gen.oneof(jsonNumber, gen.string(), gen.boolean(), gen.constant(null))
  } else {
    const fieldName = gen.string().filter((s) => !forbiddenObjectFields.includes(s))
    const subJson = jsonArbitrary(maxDepth - 1)
    return gen.oneof(
      gen.array(subJson),
      gen.array(gen.tuple(fieldName, gen.oneof(subJson, gen.constant(undefined)))).map(Object.fromEntries),
      jsonNumber,
      gen.string(),
      gen.boolean(),
      gen.constant(null),
    )
  }
}
