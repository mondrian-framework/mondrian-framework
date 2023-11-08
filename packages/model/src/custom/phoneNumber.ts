import { model } from '..'
import { fromRegexes } from './regex'

const PHONE_NUMBER_REGEX = /^\+[1-9]\d{6,14}$/

export type PhoneNumberType = model.CustomType<'phone-number', {}, string>

export function phoneNumber(options?: model.BaseOptions): PhoneNumberType {
  return fromRegexes(
    'phone-number',
    'Invalid phone number of the form (7-15 digits) [E.164]',
    options,
    undefined,
    PHONE_NUMBER_REGEX,
  )
}
