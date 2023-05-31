import { CustomTypeOpts, Result, m, validate } from '@mondrian-framework/model'

const MIN_PORT_NUMBER = 0
const MAX_PORT_NUMBER = 65535

export function port(opts?: CustomTypeOpts) {
  return m.custom(
    {
      name: 'port',
      encodedType: m.number(),
      decode: (input, opts, decodeOpts) => {
        return { success: true, value: input }
      },
      encode: (input, opts) => {
        return input
      },
      validate(input) {
        const isNumber = validate(m.integer(), input)
        if (!isNumber.success) {
          return isNumber
        }
        const inputNumber = isNumber.value
        if (inputNumber <= MIN_PORT_NUMBER || inputNumber > MAX_PORT_NUMBER) {
          return Result.error(
            `Invalid TCP port number (must be between ${MIN_PORT_NUMBER + 1} and ${MAX_PORT_NUMBER})`,
            input,
          )
        }
        return Result.success(inputNumber)
      },
    },
    opts,
  )
}

const StringOrNumber = m.union({ string: m.string(), number: m.number() })
