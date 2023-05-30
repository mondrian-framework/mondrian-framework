import { CustomType, validate, encode, decode, m } from '@mondrian-framework/model'
import { isArray } from '@mondrian-framework/utils'

export type RegExpType = CustomType<string, {}>
export function regexp(name: string, regexp: RegExp | RegExp[], error: string, opts?: RegExpType['opts']) {
  return m.custom(
    {
      name,
      decode: (input, opts, decodeOpts) => {
        return decode(m.string(), input, decodeOpts)
      },
      encode: (input, opts) => {
        return encode(m.string(), input)
      },
      validate(input) {
        const isString = validate(m.string(), input)
        if (!isString.success) {
          return isString
        }
        const regexArray = isArray(regexp) ? regexp : [regexp]
        if (!regexArray.some((r) => r.test(input as string))) {
          return { success: false, errors: [{ error, value: input }] }
        }
        return { success: true }
      },
    },
    opts,
  )
}
