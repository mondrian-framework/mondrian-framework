import { decoding, model, validation } from '..'
import gen from 'fast-check'

export type EmailType = model.CustomType<'email', {}, string>

export function email(options?: model.BaseOptions): EmailType {
  return model.custom(
    'email',
    (value) => value,
    (value) => (typeof value === 'string' ? decoding.succeed(value) : decoding.fail('Expected a mail string', value)),
    validateEmail,
    () => gen.emailAddress(),
    options,
  )
}

const EMAIL_REGEX =
  /^[-!#$%&'*+\/0-9=?A-Z^_a-z`{|}~](\.?[-!#$%&'*+\/0-9=?A-Z^_a-z`{|}~])*@[a-zA-Z0-9](-*\.?[a-zA-Z0-9])*\.[a-zA-Z](-?[a-zA-Z0-9])+$/

function validateEmail(value: string): validation.Result {
  //thanks to https://github.com/manishsaraan/email-validator
  const emailParts = value.split('@')
  if (emailParts.length !== 2) {
    return validation.fail('Invalid email (no @ present)', value)
  }
  const account = emailParts[0]
  const address = emailParts[1]
  if (account.length > 64) {
    return validation.fail('Invalid email (account is longer than 63 characters)', value)
  } else if (address.length > 255) {
    return validation.fail('Invalid email (domain is longer than 254 characters)', value)
  }
  const domainParts = address.split('.')
  if (domainParts.some((part) => part.length > 63) || !EMAIL_REGEX.test(value)) {
    return validation.fail('Invalid email', value)
  }
  return validation.succeed()
}
