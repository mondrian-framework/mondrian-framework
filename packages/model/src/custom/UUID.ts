import { types } from '..'
import { fromRegexes } from './regex'

const UUID_REGEX = /^[0-9a-fA-F]{8}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{12}$/

export type UUIDType = types.CustomType<'UUID', {}, string>

export function uuid(options?: types.BaseOptions): UUIDType {
  return fromRegexes('UUID', 'Invalid Universally Unique Identifier', options, undefined, UUID_REGEX)
}
