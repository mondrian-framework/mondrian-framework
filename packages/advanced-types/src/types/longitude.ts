import { CustomType, decode, m } from '@mondrian-framework/model'

const MIN_LON = -180.0
const MAX_LON = 180.0
const MAX_PRECISION = 8

type LongitudeType = CustomType<string, 'longitude', {}>
export function longitude(opts?: LongitudeType['opts']) {
  return (
    m.custom({
      name: 'longitude',
      decode: (input, opts, decodeOpts) => {
        const decoded = decode(m.number(), input, decodeOpts)
        if (!decoded.pass) {
          return decoded
        }

        if (decoded.value < MIN_LON || decoded.value > MAX_LON) {
          return {
            pass: false,
            errors: [{ error: `Invalid longitude number (must be between ${MIN_LON} and ${MAX_LON})`, value: input }],
          }
        }
        if (decoded.value !== Number.parseFloat(decoded.value.toFixed(MAX_PRECISION))) {
          return {
            pass: false,
            errors: [{ error: `Invalid longitude number (max precision must be ${MAX_PRECISION})`, value: input }],
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
