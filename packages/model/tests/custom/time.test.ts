import { model } from '../../src'
import { testTypeEncodingAndDecoding, testWithArbitrary } from './property-helper'
import { test, expect, describe } from 'vitest'

test('Time - encode', async () => {
  expect(model.time().encodeWithoutValidation(new Date('2023-01-01T00:00:00.223Z'))).toBe('00:00:00.223Z')
})

const today = new Date()
const year = today.getFullYear()
const month = today.getMonth()
const day = today.getDate()

const knownValidValues = [
  { raw: '00:00:00Z', expected: new Date(Date.UTC(0, 0, 0)) },
  { raw: '00:00:59Z', expected: new Date(Date.UTC(0, 0, 0, 0, 0, 59)) },
  { raw: '10:30:02.1Z', expected: new Date(Date.UTC(0, 0, 0, 10, 30, 2, 100)) },
  { raw: '09:09:06.13Z', expected: new Date(Date.UTC(0, 0, 0, 9, 9, 6, 130)) },
  { raw: '10:00:11.003Z', expected: new Date(Date.UTC(0, 0, 0, 10, 0, 11, 3)) },
  { raw: '16:10:20.1359945Z', expected: new Date(Date.UTC(0, 0, 0, 16, 10, 20, 135)) },
  { raw: '00:00:00+01:30', expected: new Date(Date.UTC(0, 0, 0, 22, 30) - 24 * 60 * 60 * 1000) },
  { raw: '00:00:30.3-01:30', expected: new Date(Date.UTC(0, 0, 0, 1, 30, 30, 300)) },
]
const knownInvalidValues = [
  'Invalid time',
  '2016-01-01T00:00:00.223Z',
  '10:30:02.Z',
  '00:00:00z',
  '26:00:00Z',
  '00:100:00Z',
  '00:00:00.45+0130',
  '00:00:00.45+01',
]

describe(
  'standard property based tests',
  testTypeEncodingAndDecoding(
    model.time(),
    {
      knownValidValues,
      knownInvalidValues,
    },
    {
      skipInverseCheck: true,
    },
  ),
)

describe('arbitrary based test', testWithArbitrary(model.time()))
