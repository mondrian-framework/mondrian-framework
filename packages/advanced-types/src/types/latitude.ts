import { CustomType, decode, m } from '@mondrian-framework/model'

const MIN_LAT = -90.0
const MAX_LAT = 90.0
const MAX_PRECISION = 8

type LatitudeType = CustomType<string, 'latitude', {}>
export function latitude(opts?: LatitudeType['opts']) {
  return (
    m.custom({
      name: 'latitude',
      decode: (input, opts, decodeOpts) => {
        const decoded = decode(m.number(), input, decodeOpts)
        if (!decoded.pass) {
          return decoded
        }

        if (decoded.value < MIN_LAT || decoded.value > MAX_LAT) {
          return {
            pass: false,
            errors: [{ error: `Invalid latitude number (must be between ${MIN_LAT} and ${MAX_LAT})`, value: input }],
          }
        }
        if (decoded.value !== Number.parseFloat(decoded.value.toFixed(MAX_PRECISION))) {
          return {
            pass: false,
            errors: [{ error: `Invalid latitude number (max precision must be ${MAX_PRECISION})`, value: input }],
          }
        }
        return decoded
      },
      encode: (input) => {
        return input
      },
      is(input) {
        return typeof input === 'number'
      },
    }),
    opts
  )
}
