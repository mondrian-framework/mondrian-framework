import { fromRegexes } from './builder'
import { m } from '@mondrian-framework/model'

const MAC_REGEX = /^(?:[0-9A-Fa-f]{2}([:-]?)[0-9A-Fa-f]{2})(?:(?:\1|\.)(?:[0-9A-Fa-f]{2}([:-]?)[0-9A-Fa-f]{2})){2}$/

export function MAC(options?: m.BaseOptions): m.CustomType<'MAC', {}, string> {
  return fromRegexes('MAC', 'Invalid IEEE 802 48-bit MAC address', options, MAC_REGEX)
}
