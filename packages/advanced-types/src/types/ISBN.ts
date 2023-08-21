import { fromRegexes } from './builder'
import { m } from '@mondrian-framework/model'

const ISBN10_REGEX = /^(?:ISBN(?:-10)?:? *)?((?=\d{1,5}([ -]?)\d{1,7}\2?\d{1,6}\2?\d)(?:\d\2*){9}[\dX])$/i
const ISBN13_REGEX = /^(?:ISBN(?:-13)?:? *)?(97(?:8|9)([ -]?)(?=\d{1,5}\2?\d{1,7}\2?\d{1,6}\2?\d)(?:\d\2*){9}\d)$/i

export type ISBNType = m.CustomType<'ISBN', {}, string>

export function isbn(options?: m.BaseOptions): ISBNType {
  return fromRegexes('ISBN', 'Invalid ISBN-10 or ISBN-13 number', options, ISBN10_REGEX, ISBN13_REGEX)
}
