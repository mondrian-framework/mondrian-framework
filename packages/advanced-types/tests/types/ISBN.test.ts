import { m } from '../../src/index'
import { testTypeEncodingAndDecoding } from './property-helper'
import { describe } from 'vitest'

const knownValidValues = [
  '978-3-16-148410-0',
  '0-545-01022-5',
  'ISBN-10 0-545-01022-5',
  'ISBN-10: 0-545-01022-5',
  'ISBN 978-3-16-148410-0',
  'ISBN-13 978-3-16-148410-0',
  'ISBN-13: 978-3-16-148410-0',
  '007462542X',
  '978-92-95055-02-5',
  '0-9767736-6-X',
]

const knownInvalidValues = [
  '',
  'AAA-3-16-148410-0',
  '978-3-16-148410',
  '213123131223212',
  'ISBSN-10 0-545-01022-5',
  'LKJLJ',
  '054501022-5',
  'ISBN--978-3-16-148410-0',
  null,
  undefined,
  11,
  11.2,
  { isbn: 'ISBN-13: 978-3-16-148410-0' },
]

describe(
  'standard property based tests',
  testTypeEncodingAndDecoding(m.isbn, {
    knownInvalidValues,
    knownValidValues,
  }),
)
