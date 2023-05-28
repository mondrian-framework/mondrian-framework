import { CustomType, decode, m } from '@mondrian-framework/model'

const JWS_REGEX = /^[a-zA-Z0-9\-_]+?\.[a-zA-Z0-9\-_]+?\.([a-zA-Z0-9\-_]+)?$/

type JWT = CustomType<string, 'JWT', {}>
export function JWT(opts?: JWT['opts']) {
  return (
    m.custom({
      name: 'ISBN',
      decode: (input, opts, decodeOpts) => {
        const decoded = decode(m.string(), input, decodeOpts)
        if (!decoded.pass) {
          return decoded
        }
        if (!JWS_REGEX.test(decoded.value)) {
          return {
            pass: false,
            errors: [{ error: 'Invalid JWT', value: input }],
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
