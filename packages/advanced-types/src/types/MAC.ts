import { CustomType, decode, m } from '@mondrian-framework/model'

const MAC_REGEX = /^(?:[0-9A-Fa-f]{2}([:-]?)[0-9A-Fa-f]{2})(?:(?:\1|\.)(?:[0-9A-Fa-f]{2}([:-]?)[0-9A-Fa-f]{2})){2}$/

type MACType = CustomType<string, 'MAC', {}>
export function MAC(opts?: MACType['opts']) {
  return (
    m.custom({
      name: 'MAC',
      decode: (input, opts, decodeOpts) => {
        const decoded = decode(m.string(), input, decodeOpts)
        if (!decoded.pass) {
          return decoded
        }
        if (!MAC_REGEX.test(decoded.value)) {
          return {
            pass: false,
            errors: [{ error: 'Invalid IEEE 802 48-bit MAC address', value: input }],
          }
        }
        return decoded
      },
      encode: (input) => {
        return input
      },
      is(input) {
        return typeof input === 'string'
      },
    }),
    opts
  )
}
