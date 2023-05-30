import { RegExpOpts, regexp } from './regexp'

const MAC_REGEX = /^(?:[0-9A-Fa-f]{2}([:-]?)[0-9A-Fa-f]{2})(?:(?:\1|\.)(?:[0-9A-Fa-f]{2}([:-]?)[0-9A-Fa-f]{2})){2}$/

export function MAC(opts?: RegExpOpts) {
  return regexp('MAC', MAC_REGEX, 'Invalid IEEE 802 48-bit MAC address', opts)
}
