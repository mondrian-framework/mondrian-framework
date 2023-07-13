import { fromRegexes } from './builder'
import { m } from '@mondrian-framework/model'

const JWT_REGEX = /^[a-zA-Z0-9\-_]+?\.[a-zA-Z0-9\-_]+?\.([a-zA-Z0-9\-_]+)?$/

export function jwt(options?: m.BaseOptions): m.CustomType<'JWT', {}, string> {
  return fromRegexes('JWT', 'Invalid JWT', options, JWT_REGEX)
}
