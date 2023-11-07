import { types } from '..'
import { fromRegexes } from './regex'
import gen from 'fast-check'

const MAC_REGEX = /^(?:[0-9A-Fa-f]{2}([:-]?)[0-9A-Fa-f]{2})(?:(?:\1|\.)(?:[0-9A-Fa-f]{2}([:-]?)[0-9A-Fa-f]{2})){2}$/

export type MACType = types.CustomType<'MAC', {}, string>

export function mac(options?: types.BaseOptions): MACType {
  return fromRegexes(
    'MAC',
    'Invalid IEEE 802 48-bit MAC address',
    options,
    gen
      .array(gen.integer({ min: 0, max: 255 }), { maxLength: 6, minLength: 6 })
      .map((bytes) => bytes.map((b) => b.toString(16).padStart(2, '0')).join(':')),
    MAC_REGEX,
  )
}
