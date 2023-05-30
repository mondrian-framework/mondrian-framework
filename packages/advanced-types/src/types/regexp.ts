import { validate, m, CustomTypeOpts } from '@mondrian-framework/model'
import { isArray } from '@mondrian-framework/utils'

export type RegExpOpts = CustomTypeOpts
export function regexp(name: string, regexp: RegExp | RegExp[], error: string, opts?: RegExpOpts) {
  return m.custom(
    {
      name,
      encodedType: m.string(),
      decode: (input, opts, decodeOpts) => {
        return { success: true, value: input }
      },
      encode: (input, opts) => {
        return input
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
