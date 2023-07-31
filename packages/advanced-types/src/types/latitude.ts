import { fc as gen } from '@fast-check/vitest'
import { m } from '@mondrian-framework/model'
import { error, success, Result } from '@mondrian-framework/model'

const MIN_LAT = -90.0
const MAX_LAT = 90.0
const MAX_PRECISION = 8

export function latitude(options?: m.BaseOptions): m.CustomType<'latitude', {}, number> {
  return m.custom(
    'latitude',
    (number) => number,
    (value) => (typeof value === 'number' ? success(value) : error('Expected a latitude number', value)),
    validateLatitude,
    gen.double({ min: MIN_LAT, max: MAX_LAT }).map((v) => Number.parseFloat(v.toFixed(MAX_PRECISION))),
    options,
  )
}

function validateLatitude(value: number): Result<true> {
  if (value < MIN_LAT || value > MAX_LAT) {
    return error(`Invalid latitude number (must be between ${MIN_LAT} and ${MAX_LAT})`, value)
  } else if (value !== Number.parseFloat(value.toFixed(MAX_PRECISION))) {
    return error(`Invalid latitude number (max precision must be ${MAX_PRECISION})`, value)
  } else {
    return success(true)
  }
}
