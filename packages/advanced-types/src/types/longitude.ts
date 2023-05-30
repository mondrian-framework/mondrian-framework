import { CustomType, decode, encode, m, validate } from '@mondrian-framework/model'

const MIN_LON = -180.0
const MAX_LON = 180.0
const MAX_PRECISION = 8

type LongitudeType = CustomType<number, {}>
export function longitude(opts?: LongitudeType['opts']) {
  return m.custom(
    {
      name: 'longitude',
      decode: (input, opts, decodeOpts) => {
        return decode(m.number(), input, decodeOpts)
      },
      encode: (input, opts) => {
        return encode(m.number(), input)
      },
      validate(input) {
        const isNumber = validate(m.number(), input)
        if (!isNumber.success) {
          return isNumber
        }
        const inputNumber = input as number
        if (inputNumber < MIN_LON || inputNumber > MAX_LON) {
          return {
            success: false,
            errors: [{ error: `Invalid longitude number (must be between ${MIN_LON} and ${MAX_LON})`, value: input }],
          }
        }
        if (inputNumber !== Number.parseFloat(inputNumber.toFixed(MAX_PRECISION))) {
          return {
            success: false,
            errors: [{ error: `Invalid longitude number (max precision must be ${MAX_PRECISION})`, value: input }],
          }
        }
        return { success: true }
      },
    },
    opts,
  )
}
