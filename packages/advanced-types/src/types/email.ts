import { CustomType, decode, encode, is, m } from '@mondrian-framework/model'

const EMAIL_REGEX =
  /^[-!#$%&'*+\/0-9=?A-Z^_a-z`{|}~](\.?[-!#$%&'*+\/0-9=?A-Z^_a-z`{|}~])*@[a-zA-Z0-9](-*\.?[a-zA-Z0-9])*\.[a-zA-Z](-?[a-zA-Z0-9])+$/

type EmailType = CustomType<string, {}>
export function email(opts?: EmailType['opts']) {
  return m.custom(
    {
      name: 'email',
      decode: (input, opts, decodeOpts) => {
        return decode(m.string(), input, decodeOpts)
      },
      encode: (input, opts) => {
        return encode(m.string(), input)
      },
      is(input) {
        const isString = is(m.string(), input)
        if (!isString.success) {
          return isString
        }
        const inputString = <string>input

        //thanks to https://github.com/manishsaraan/email-validator
        const emailParts = inputString.split('@')
        if (emailParts.length !== 2) {
          return {
            success: false,
            errors: [{ error: 'Invalid email (no @ present)', value: input }],
          }
        }
        const account = emailParts[0]
        const address = emailParts[1]
        if (account.length > 64) {
          return {
            success: false,
            errors: [{ error: 'Invalid email (account is longer than 63 characters)', value: input }],
          }
        } else if (address.length > 255) {
          return {
            success: false,
            errors: [{ error: 'Invalid email (domain is longer than 254 characters)', value: input }],
          }
        }
        const domainParts = address.split('.')
        if (
          domainParts.some(function (part) {
            return part.length > 63
          }) ||
          !EMAIL_REGEX.test(inputString)
        ) {
          return {
            success: false,
            errors: [{ error: 'Invalid email', value: input }],
          }
        }
        return { success: true }
      },
    },
    opts,
  )
}
