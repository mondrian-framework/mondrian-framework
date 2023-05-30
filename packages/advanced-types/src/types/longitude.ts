import { CustomTypeOpts, Result, m, validate } from '@mondrian-framework/model'

const MIN_LON = -180.0
const MAX_LON = 180.0
const MAX_PRECISION = 8

export function longitude(opts?: CustomTypeOpts) {
  return m.custom(
    {
      name: 'longitude',
      encodedType: m.number(),
      decode: (input, opts, decodeOpts) => {
        return { success: true, value: input }
      },
      encode: (input, opts) => {
        return input
      },
      validate(input) {
        const isNumber = validate(m.number(), input)
        if (!isNumber.success) {
          return isNumber
        }
        const inputNumber = isNumber.value
        if (inputNumber < MIN_LON || inputNumber > MAX_LON) {
          return Result.error(`Invalid longitude number (must be between ${MIN_LON} and ${MIN_LON})`, input)
        }
        if (inputNumber !== Number.parseFloat(inputNumber.toFixed(MAX_PRECISION))) {
          return Result.error(`Invalid longitude number (max precision must be ${MAX_PRECISION})`, input)
        }
        return Result.success(inputNumber)
      },
    },
    opts,
  )
}
