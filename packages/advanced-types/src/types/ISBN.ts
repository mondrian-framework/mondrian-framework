import { RegExpOpts, regexp } from './regexp'

const ISBN10_REGEX = /^(?:ISBN(?:-10)?:? *)?((?=\d{1,5}([ -]?)\d{1,7}\2?\d{1,6}\2?\d)(?:\d\2*){9}[\dX])$/i
const ISBN13_REGEX = /^(?:ISBN(?:-13)?:? *)?(97(?:8|9)([ -]?)(?=\d{1,5}\2?\d{1,7}\2?\d{1,6}\2?\d)(?:\d\2*){9}\d)$/i

export function ISBN(opts?: RegExpOpts) {
  return regexp('ISBN', [ISBN10_REGEX, ISBN13_REGEX], 'Invalid ISBN-10 or ISBN-13 number', opts)
}
