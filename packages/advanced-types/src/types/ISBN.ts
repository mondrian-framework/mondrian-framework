import { CustomType, decode, m } from '@mondrian-framework/model'

const ISBN10_REGEX = /^(?:ISBN(?:-10)?:? *)?((?=\d{1,5}([ -]?)\d{1,7}\2?\d{1,6}\2?\d)(?:\d\2*){9}[\dX])$/i
const ISBN13_REGEX = /^(?:ISBN(?:-13)?:? *)?(97(?:8|9)([ -]?)(?=\d{1,5}\2?\d{1,7}\2?\d{1,6}\2?\d)(?:\d\2*){9}\d)$/i

type ISBN = CustomType<string, 'ISBN', {}>
export function ISBN(opts?: ISBN['opts']) {
  return (
    m.custom({
      name: 'ISBN',
      decode: (input, opts, decodeOpts) => {
        const decoded = decode(m.string(), input, decodeOpts)
        if (!decoded.pass) {
          return decoded
        }
        if (!ISBN10_REGEX.test(decoded.value) && !ISBN13_REGEX.test(decoded.value)) {
          return {
            pass: false,
            errors: [{ error: 'Invalid ISBN-10 or ISBN-13 number', value: input }],
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
