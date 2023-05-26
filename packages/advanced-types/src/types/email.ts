import { CustomType, decode, m } from '@mondrian-framework/model'

type EmailType = CustomType<string, 'email', {}>
export function email(opts?: EmailType['opts']) {
  return (
    m.custom({
      name: 'email',
      decode: (input, opts, decodeOpts) => {
        const decoded = decode(m.string(), input)
        if (!decoded.pass) {
          return decoded
        }

        //thanks to https://github.com/manishsaraan/email-validator
        const tester =
          /^[-!#$%&'*+\/0-9=?A-Z^_a-z`{|}~](\.?[-!#$%&'*+\/0-9=?A-Z^_a-z`{|}~])*@[a-zA-Z0-9](-*\.?[a-zA-Z0-9])*\.[a-zA-Z](-?[a-zA-Z0-9])+$/
        const emailParts = decoded.value.split('@')
        if (emailParts.length !== 2) {
          return {
            pass: false,
            errors: [{ error: 'Invalid email (no @ present)', value: input }],
          }
        }
        const account = emailParts[0]
        const address = emailParts[1]
        if (account.length > 64) {
          return {
            pass: false,
            errors: [{ error: 'Invalid email (account is longer than 63 characters)', value: input }],
          }
        } else if (address.length > 255) {
          return {
            pass: false,
            errors: [{ error: 'Invalid email (domain is longer than 254 characters)', value: input }],
          }
        }
        const domainParts = address.split('.')
        if (
          domainParts.some(function (part) {
            return part.length > 63
          }) ||
          !tester.test(decoded.value)
        ) {
          return {
            pass: false,
            errors: [{ error: 'Invalid email', value: input }],
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
