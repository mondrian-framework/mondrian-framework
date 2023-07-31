import { fc as gen } from '@fast-check/vitest'
import { m } from '@mondrian-framework/model'
import { error, success, Result } from '@mondrian-framework/model'

export function email(options?: m.BaseOptions): m.CustomType<'email', {}, string> {
  return m.custom(
    'email',
    (value) => value,
    (value) => (typeof value === 'string' ? success(value) : error('Expected a mail string', value)),
    validateEmail,
    gen.emailAddress(),
    options,
  )
}

const EMAIL_REGEX =
  /^[-!#$%&'*+\/0-9=?A-Z^_a-z`{|}~](\.?[-!#$%&'*+\/0-9=?A-Z^_a-z`{|}~])*@[a-zA-Z0-9](-*\.?[a-zA-Z0-9])*\.[a-zA-Z](-?[a-zA-Z0-9])+$/

function validateEmail(value: string): Result<true> {
  //thanks to https://github.com/manishsaraan/email-validator
  const emailParts = value.split('@')
  if (emailParts.length !== 2) {
    return error('Invalid email (no @ present)', value)
  }
  const account = emailParts[0]
  const address = emailParts[1]
  if (account.length > 64) {
    return error('Invalid email (account is longer than 63 characters)', value)
  } else if (address.length > 255) {
    return error('Invalid email (domain is longer than 254 characters)', value)
  }
  const domainParts = address.split('.')
  if (domainParts.some((part) => part.length > 63) || !EMAIL_REGEX.test(value)) {
    return error('Invalid email', value)
  }
  return success(true)
}
