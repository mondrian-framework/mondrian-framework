import { path } from '../src'
import { test } from '@fast-check/vitest'
import { expect } from 'vitest'

test('path builders', () => {
  expect(path.root).toEqual('$')
  expect(path.ofField('a1')).toEqual('$.a1')
  expect(path.ofIndex(2)).toEqual('$[2]')
  expect(path.appendIndex('$.a', 2)).toEqual('$.a[2]')
  expect(path.appendField('$.a', 'b')).toEqual('$.a.b')
  expect(path.prependIndex('$.a', 2)).toEqual('$[2].a')
  expect(path.prependField('$.a', 'b')).toEqual('$.b.a')
  expect(path.prependFieldToAll([{ path: '$.a' }], 'b')).toEqual([{ path: '$.b.a' }])
  expect(path.prependIndexToAll([{ path: '$.a' }], 2)).toEqual([{ path: '$[2].a' }])

  expect(path.ofField('')).toEqual('$[""]')
  expect(path.ofField('-')).toEqual('$["-"]')
  expect(path.ofField('_123')).toEqual('$["_123"]')
  expect(path.ofField('123')).toEqual('$["123"]')
  expect(path.appendField('$.a', '_123')).toEqual('$.a["_123"]')
  expect(path.prependField('$.a', '_123')).toEqual('$["_123"].a')
})
