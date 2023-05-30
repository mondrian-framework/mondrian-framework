import { validate, m, CustomTypeOpts, Result } from '@mondrian-framework/model'
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
        if (!regexArray.some((r) => r.test(isString.value))) {
          return Result.error(error, input)
        }
        return Result.success(isString.value)
      },
    },
    opts,
  )
}
