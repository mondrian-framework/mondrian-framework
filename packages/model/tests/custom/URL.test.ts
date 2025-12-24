import { model } from '../../src'
import { testTypeEncodingAndDecoding, testWithArbitrary } from './property-helper'
import { fc as gen } from '@fast-check/vitest'
import { describe, test, expect } from 'vitest'

const validValues = gen.webUrl().map((urlString) => ({ raw: urlString, expected: urlString }))
const knownValidValues = [
  { raw: 'http://www.google.com/', expected: 'http://www.google.com/' },
  { raw: 'https://www.google.com', expected: 'https://www.google.com' },
]

const knownInvalidValues = [
  'smtp://www.google.com/',
  'www.google.com',
  'google.com',
  'google',
  'http://',
  -200,
  2000000,
  10.1,
  null,
  undefined,
  { field: 42 },
  NaN,
]

describe(
  'standard property based tests',
  testTypeEncodingAndDecoding(
    model.url({ allowedProtocols: ['http', 'https'] }),
    {
      validValues,
      knownValidValues,
      knownInvalidValues,
    },
    {
      skipInverseCheck: true,
    },
  ),
)

describe('arbitrary based test', testWithArbitrary(model.url()))

describe('URL type additional tests', () => {
  test('decodes URL object to href string', () => {
    const urlType = model.url()
    const urlObject = new URL('https://example.com/path')
    const result = urlType.decodeWithoutValidation(urlObject)
    expect(result.isOk).toBe(true)
    if (result.isOk) {
      expect(result.value).toBe('https://example.com/path')
    }
  })

  test('validates maxLength constraint - valid', () => {
    const urlType = model.url({ maxLength: 50 })
    const result = urlType.validate('https://example.com')
    expect(result.isOk).toBe(true)
  })

  test('validates maxLength constraint - invalid', () => {
    const urlType = model.url({ maxLength: 10 })
    const result = urlType.validate('https://example.com/very/long/path/that/exceeds/limit')
    expect(result.isFailure).toBe(true)
    if (result.isFailure) {
      expect(result.error[0].assertion).toContain('too long')
    }
  })

  test('validates allowedProtocols - valid', () => {
    const urlType = model.url({ allowedProtocols: ['https'] })
    const result = urlType.validate('https://example.com')
    expect(result.isOk).toBe(true)
  })

  test('validates allowedProtocols - invalid', () => {
    const urlType = model.url({ allowedProtocols: ['https'] })
    const result = urlType.validate('http://example.com')
    expect(result.isFailure).toBe(true)
    if (result.isFailure) {
      expect(result.error[0].assertion).toContain('Invalid protocol')
    }
  })

  test('validates multiple allowedProtocols', () => {
    const urlType = model.url({ allowedProtocols: ['http', 'https', 'ftp'] })

    expect(urlType.validate('http://example.com').isOk).toBe(true)
    expect(urlType.validate('https://example.com').isOk).toBe(true)
    expect(urlType.validate('ftp://example.com').isOk).toBe(true)
    expect(urlType.validate('smtp://example.com').isFailure).toBe(true)
  })

  test('rejects invalid URL format', () => {
    const urlType = model.url()
    const result = urlType.validate('not-a-valid-url')
    expect(result.isFailure).toBe(true)
    if (result.isFailure) {
      expect(result.error[0].assertion).toContain('Invalid URL format')
    }
  })

  test('url without options validates any valid URL', () => {
    const urlType = model.url()
    expect(urlType.validate('https://example.com').isOk).toBe(true)
    expect(urlType.validate('http://example.com').isOk).toBe(true)
    expect(urlType.validate('ftp://example.com').isOk).toBe(true)
  })
})
