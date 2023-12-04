import { decoding, model, validation } from '../..'
import gen from 'fast-check'

const MIN_LAT = -90.0
const MAX_LAT = 90.0
const MAX_PRECISION = 8

export type LatitudeType = model.CustomType<'latitude', {}, number>

export function latitude(options?: model.BaseOptions): LatitudeType {
  return model.custom({ typeName: 'latitude', encoder, decoder, validator, arbitrary, options })
}

function encoder(value: number): number {
  return value
}

function decoder(value: unknown): decoding.Result<number> {
  if (typeof value === 'number') {
    return decoding.succeed(value)
  } else {
    return decoding.fail('Expected a latitude number', value)
  }
}

function validator(value: number): validation.Result {
  if (value < MIN_LAT || value > MAX_LAT) {
    return validation.fail(`Invalid latitude number (must be between ${MIN_LAT} and ${MAX_LAT})`, value)
  } else if (value !== Number.parseFloat(value.toFixed(MAX_PRECISION))) {
    return validation.fail(`Invalid latitude number (max precision must be ${MAX_PRECISION})`, value)
  } else {
    return validation.succeed()
  }
}

function arbitrary(): gen.Arbitrary<number> {
  return gen.integer({ min: MIN_LAT * 1000, max: MAX_LAT * 1000 }).map((v) => v / 1000)
}
