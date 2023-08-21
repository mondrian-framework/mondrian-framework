import { fromRegexes } from './builder'
import { m } from '@mondrian-framework/model'

const MAC_REGEX = /^(?:[0-9A-Fa-f]{2}([:-]?)[0-9A-Fa-f]{2})(?:(?:\1|\.)(?:[0-9A-Fa-f]{2}([:-]?)[0-9A-Fa-f]{2})){2}$/

export type MACType = m.CustomType<'MAC', {}, string>

export function mac(options?: m.BaseOptions): MACType {
  return fromRegexes('MAC', 'Invalid IEEE 802 48-bit MAC address', options, MAC_REGEX)
}
