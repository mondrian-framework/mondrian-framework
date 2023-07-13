import { fromRegexes } from './builder'
import { m } from '@mondrian-framework/model'

const UUID_REGEX = /^(\{){0,1}[0-9a-fA-F]{8}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{12}(\}){0,1}$/

export function UUID(options?: m.BaseOptions): m.CustomType<'UUID', {}, string> {
  return fromRegexes('UUID', 'Invalid Universally Unique Identifier', options, UUID_REGEX)
}
