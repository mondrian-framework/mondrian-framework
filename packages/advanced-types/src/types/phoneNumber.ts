import { RegExpOpts, regexp } from './regexp'

const PHONE_NUMBER_REGEX = /^\+[1-9]\d{6,14}$/

export function phoneNumber(opts?: RegExpOpts) {
  return regexp('phone-number', PHONE_NUMBER_REGEX, 'Invalid phone number of the form (7-15 digits) [E.164]', opts)
}
