import { fromRegexes } from './builder'
import { m } from '@mondrian-framework/model'

const JWT_REGEX = /^[a-zA-Z0-9\-_]+?\.[a-zA-Z0-9\-_]+?\.([a-zA-Z0-9\-_]+)?$/

export function jwt(options?: m.BaseOptions): m.CustomType<'JWT', {}, string> {
  //TODO: regex is not exaustive, a jwt should always decode
  //Could be cool if we add a generic param (body of the jwt)
  return fromRegexes('JWT', 'Invalid JWT', options, JWT_REGEX)
}
