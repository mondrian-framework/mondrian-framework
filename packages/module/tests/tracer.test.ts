import { voidTracer } from '../src/function/tracer'
import { expect, test } from 'vitest'

test('void tracer', () => {
  voidTracer.startActiveSpan('', (span) => {
    expect(span).toBeUndefined()
  })
})
