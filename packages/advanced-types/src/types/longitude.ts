import { m } from '@mondrian-framework/model'
import { result } from '@mondrian-framework/model'

const MIN_LON = -180.0
const MAX_LON = 180.0
const MAX_PRECISION = 8

export type LongitudeType = m.CustomType<'longitude', {}, number>

export function longitude(options?: m.BaseOptions): m.CustomType<'longitude', {}, number> {
  return m.custom(
    'longitude',
    (number) => number,
    (value) => (typeof value === 'number' ? result.success(value) : result.error('Expected a longitude number', value)),
    validateLongitude,
    options,
  )
}

function validateLongitude(value: number): result.Result<true> {
  if (value < MIN_LON || value > MAX_LON) {
    return result.error(`Invalid longitude number (must be between ${MIN_LON} and ${MIN_LON})`, value)
  } else if (value !== Number.parseFloat(value.toFixed(MAX_PRECISION))) {
    return result.error(`Invalid longitude number (max precision must be ${MAX_PRECISION})`, value)
  } else {
    return result.success(true)
  }
}
