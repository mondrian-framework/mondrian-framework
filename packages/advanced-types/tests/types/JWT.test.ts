import { m } from '../../src/index'
import { testTypeEncodingAndDecoding } from './property-helper'
import t from '@mondrian-framework/model'
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

describe(
  'hs standard property based tests',
  testTypeEncodingAndDecoding(
    m.jwt('login', t.object({ sub: t.string(), name: t.string(), iat: t.integer() }), 'your-256-bit-secret', {
      algorithm: 'HS256',
    }),
    {
      knownValidValues,
      knownInvalidValues,
    },
  ),
)
