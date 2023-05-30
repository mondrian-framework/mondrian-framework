import { CustomType, decode, encode, m, validate } from '@mondrian-framework/model'

const MIN_LAT = -90.0
const MAX_LAT = 90.0
const MAX_PRECISION = 8

type LatitudeType = CustomType<number, {}>
export function latitude(opts?: LatitudeType['opts']) {
  return m.custom(
    {
      name: 'latitude',
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
        if (inputNumber < MIN_LAT || inputNumber > MAX_LAT) {
          return {
            success: false,
            errors: [{ error: `Invalid latitude number (must be between ${MIN_LAT} and ${MAX_LAT})`, value: input }],
          }
        }
        if (inputNumber !== Number.parseFloat(inputNumber.toFixed(MAX_PRECISION))) {
          return {
            success: false,
            errors: [{ error: `Invalid latitude number (max precision must be ${MAX_PRECISION})`, value: input }],
          }
        }
        return { success: true }
      },
    },
    opts,
  )
}
