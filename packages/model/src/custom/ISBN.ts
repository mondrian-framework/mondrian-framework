import { types } from '..'
import { fromRegexes } from './regex'
import gen from 'fast-check'

const ISBN10_REGEX = /^(?:ISBN(?:-10)?:? *)?((?=\d{1,5}([ -]?)\d{1,7}\2?\d{1,6}\2?\d)(?:\d\2*){9}[\dX])$/i
const ISBN13_REGEX = /^(?:ISBN(?:-13)?:? *)?(97(?:8|9)([ -]?)(?=\d{1,5}\2?\d{1,7}\2?\d{1,6}\2?\d)(?:\d\2*){9}\d)$/i

export type ISBNType = types.CustomType<'ISBN', {}, string>

export function isbn(options?: types.BaseOptions): ISBNType {
  return fromRegexes(
    'ISBN',
    'Invalid ISBN-10 or ISBN-13 number',
    options,
    gen
      .tuple(
        gen.integer({ min: 8, max: 9 }).map((v) => `97${v}`),
        gen.integer({ min: 0, max: 9 }).map((v) => v.toString()),
        gen.integer({ min: 0, max: 99 }).map((v) => v.toString().padStart(2, '0')),
        gen.integer({ min: 0, max: 999999 }).map((v) => v.toString().padStart(6, '0')),
        gen.integer({ min: 0, max: 9 }).map((v) => v.toString()),
      )
      .map((v) => `ISBN ${v.join('-')}`),
    ISBN10_REGEX,
    ISBN13_REGEX,
  )
}
