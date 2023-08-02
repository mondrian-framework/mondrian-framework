import { decoder, m, validator } from '@mondrian-framework/model'

const MIN_LON = -180.0
const MAX_LON = 180.0
const MAX_PRECISION = 8

export type LongitudeType = m.CustomType<'longitude', {}, number>

export function longitude(options?: m.BaseOptions): m.CustomType<'longitude', {}, number> {
  return m.custom(
    'longitude',
    (number) => number,
    (value) =>
      typeof value === 'number' ? decoder.succeed(value) : decoder.baseFail('Expected a longitude number', value),
    validateLongitude,
    options,
  )
}

function validateLongitude(value: number): validator.Result {
  if (value < MIN_LON || value > MAX_LON) {
    return validator.baseFail(`Invalid longitude number (must be between ${MIN_LON} and ${MIN_LON})`, value)
  } else if (value !== Number.parseFloat(value.toFixed(MAX_PRECISION))) {
    return validator.baseFail(`Invalid longitude number (max precision must be ${MAX_PRECISION})`, value)
  } else {
    return validator.succeed()
  }
}
