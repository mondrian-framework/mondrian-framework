import { voidTracer } from '../src/function/base'
import { expect, test } from 'vitest'

test('void tracer', () => {
  voidTracer.withPrefix('asd').startActiveSpanWithOptions('', {}, (span) => {
    expect(span).toBeUndefined()
  })
  voidTracer.startActiveSpan('', (span) => {
    expect(span).toBeUndefined()
  })
})
