import { decoder, m, validator } from '@mondrian-framework/model'

const MIN_LAT = -90.0
const MAX_LAT = 90.0
const MAX_PRECISION = 8

export type LatitudeType = m.CustomType<'latitude', {}, number>

export function latitude(options?: m.BaseOptions): LatitudeType {
  return m.custom(
    'latitude',
    (number) => number,
    (value) =>
      typeof value === 'number' ? decoder.succeed(value) : decoder.baseFail('Expected a latitude number', value),
    validateLatitude,
    options,
  )
}

function validateLatitude(value: number): validator.Result {
  if (value < MIN_LAT || value > MAX_LAT) {
    return validator.baseFail(`Invalid latitude number (must be between ${MIN_LAT} and ${MAX_LAT})`, value)
  } else if (value !== Number.parseFloat(value.toFixed(MAX_PRECISION))) {
    return validator.baseFail(`Invalid latitude number (max precision must be ${MAX_PRECISION})`, value)
  } else {
    return validator.succeed()
  }
}
