import { decoding, model, validation } from '../..'
import gen from 'fast-check'

const MIN_LON = -180.0
const MAX_LON = 180.0
const MAX_PRECISION = 8

export type LongitudeType = model.CustomType<'longitude', {}, number>

export function longitude(options?: model.BaseOptions): model.CustomType<'longitude', {}, number> {
  return model.custom(
    'longitude',
    (number) => number,
    (value) =>
      typeof value === 'number' ? decoding.succeed(value) : decoding.fail('Expected a longitude number', value),
    validateLongitude,
    () => gen.integer({ min: MIN_LON * 1000, max: MAX_LON * 1000 }).map((v) => v / 1000),
    options,
  )
}

function validateLongitude(value: number): validation.Result {
  if (value < MIN_LON || value > MAX_LON) {
    return validation.fail(`Invalid longitude number (must be between ${MIN_LON} and ${MIN_LON})`, value)
  } else if (value !== Number.parseFloat(value.toFixed(MAX_PRECISION))) {
    return validation.fail(`Invalid longitude number (max precision must be ${MAX_PRECISION})`, value)
  } else {
    return validation.succeed()
  }
}
