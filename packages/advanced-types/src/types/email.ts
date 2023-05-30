import { CustomTypeOpts, Result, m, validate } from '@mondrian-framework/model'

const EMAIL_REGEX =
  /^[-!#$%&'*+\/0-9=?A-Z^_a-z`{|}~](\.?[-!#$%&'*+\/0-9=?A-Z^_a-z`{|}~])*@[a-zA-Z0-9](-*\.?[a-zA-Z0-9])*\.[a-zA-Z](-?[a-zA-Z0-9])+$/

export function email(opts?: CustomTypeOpts) {
  return m.custom(
    {
      name: 'email',
      format: 'email',
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
        const inputString = isString.value

        //thanks to https://github.com/manishsaraan/email-validator
        const emailParts = inputString.split('@')
        if (emailParts.length !== 2) {
          return Result.error('Invalid email (no @ present)', input)
        }
        const account = emailParts[0]
        const address = emailParts[1]
        if (account.length > 64) {
          return Result.error('Invalid email (account is longer than 63 characters)', input)
        } else if (address.length > 255) {
          return Result.error('Invalid email (domain is longer than 254 characters)', input)
        }
        const domainParts = address.split('.')
        if (domainParts.some((part) => part.length > 63) || !EMAIL_REGEX.test(inputString)) {
          return Result.error('Invalid email', input)
        }
        return Result.success(inputString)
      },
    },
    opts,
  )
}
