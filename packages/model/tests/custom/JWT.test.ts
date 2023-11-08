import { model } from '../../src'
import { testTypeEncodingAndDecoding, testWithArbitrary } from './property-helper'
import { describe } from 'vitest'

const knownValidValues: readonly unknown[] = [
  {
    raw: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    expected: { sub: '1234567890', name: 'John Doe', iat: 1516239022 },
  },
]

const knownInvalidValues: readonly unknown[] = [
  '',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQSflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
  'InR5cCI6IkpXVCJ9kpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwp',
  '{ "sub": "1234567890","name": "John Doe","iat": 1516239022 }',
  null,
  undefined,
  11,
  11.2,
  { sub: '1234567890', name: 'John Doe', iat: 1516239022 },
]

const Model = model.jwt(
  'login',
  model.object({ sub: model.string(), name: model.string(), iat: model.integer() }),
  'your-256-bit-secret',
  {
    algorithm: 'HS256',
  },
)
describe(
  'hs standard property based tests',
  testTypeEncodingAndDecoding(Model, {
    knownValidValues,
    knownInvalidValues,
  }),
)

describe('arbitrary based test', testWithArbitrary(Model))
