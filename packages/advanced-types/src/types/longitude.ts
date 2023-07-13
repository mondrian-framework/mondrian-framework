import { m } from '@mondrian-framework/model'
import { Result, error, success } from '@mondrian-framework/model/src/result'

const MIN_LON = -180.0
const MAX_LON = 180.0
const MAX_PRECISION = 8

export function longitude(options?: m.BaseOptions): m.CustomType<'longitude', {}, number> {
  return m.custom(
    'longitude',
    (number) => number,
    (value) => (typeof value === 'number' ? success(value) : error('Expected a longitude number', value)),
    validateLongitude,
    options,
  )
}

function validateLongitude(value: number): Result<number> {
  if (value < MIN_LON || value > MAX_LON) {
    return error(`Invalid longitude number (must be between ${MIN_LON} and ${MIN_LON})`, value)
  } else if (value !== Number.parseFloat(value.toFixed(MAX_PRECISION))) {
    return error(`Invalid longitude number (max precision must be ${MAX_PRECISION})`, value)
  } else {
    return success(value)
  }
}
