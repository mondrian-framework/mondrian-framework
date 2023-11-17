import { decoding, model, validation } from '../..'
import gen from 'fast-check'

const MIN_LAT = -90.0
const MAX_LAT = 90.0
const MAX_PRECISION = 8

export type LatitudeType = model.CustomType<'latitude', {}, number>

export function latitude(options?: model.BaseOptions): LatitudeType {
  return model.custom(
    'latitude',
    (number) => number,
    (value) =>
      typeof value === 'number' ? decoding.succeed(value) : decoding.fail('Expected a latitude number', value),
    validateLatitude,
    () => gen.integer({ min: MIN_LAT * 1000, max: MAX_LAT * 1000 }).map((v) => v / 1000),
    options,
  )
}

function validateLatitude(value: number): validation.Result {
  if (value < MIN_LAT || value > MAX_LAT) {
    return validation.fail(`Invalid latitude number (must be between ${MIN_LAT} and ${MAX_LAT})`, value)
  } else if (value !== Number.parseFloat(value.toFixed(MAX_PRECISION))) {
    return validation.fail(`Invalid latitude number (max precision must be ${MAX_PRECISION})`, value)
  } else {
    return validation.succeed()
  }
}
