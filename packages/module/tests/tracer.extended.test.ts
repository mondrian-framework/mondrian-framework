import { VoidTracer, TracerWrapper, voidTracer } from '../src/function/tracer'
import { Span, SpanOptions, Tracer, SpanContext, SpanKind } from '@opentelemetry/api'
import { describe, expect, test, vi } from 'vitest'

describe('VoidTracer', () => {
  describe('startActiveSpan', () => {
    test('should call function with undefined span', () => {
      const result = voidTracer.startActiveSpan('test-span', (span) => {
        expect(span).toBeUndefined()
        return 'result'
      })

      expect(result).toBe('result')
    })

    test('should handle async functions', async () => {
      const result = await voidTracer.startActiveSpan('test-span', async (span) => {
        expect(span).toBeUndefined()
        return Promise.resolve('async-result')
      })

      expect(result).toBe('async-result')
    })

    test('should handle functions that throw', () => {
      expect(() => {
        voidTracer.startActiveSpan('test-span', () => {
          throw new Error('test error')
        })
      }).toThrow('test error')
    })
  })

  describe('startActiveSpanWithOptions', () => {
    test('should call function with undefined span ignoring options', () => {
      const options: SpanOptions = { kind: SpanKind.INTERNAL }
      const result = voidTracer.startActiveSpanWithOptions('test-span', options, (span) => {
        expect(span).toBeUndefined()
        return 'result-with-options'
      })

      expect(result).toBe('result-with-options')
    })

    test('should handle async functions with options', async () => {
      const options: SpanOptions = { attributes: { key: 'value' } }
      const result = await voidTracer.startActiveSpanWithOptions('test-span', options, async (span) => {
        expect(span).toBeUndefined()
        return Promise.resolve('async-result')
      })

      expect(result).toBe('async-result')
    })

    test('should handle complex options', () => {
      const options: SpanOptions = {
        kind: SpanKind.CLIENT,
        attributes: { 'http.method': 'GET', 'http.url': 'https://example.com' },
      }
      const result = voidTracer.startActiveSpanWithOptions('http-request', options, (span) => {
        return { status: 200 }
      })

      expect(result).toEqual({ status: 200 })
    })
  })
})

describe('TracerWrapper', () => {
  const createMockTracer = (): Tracer => {
    return {
      startSpan: vi.fn(),
      startActiveSpan: vi.fn((name: string, ...args: any[]) => {
        const fn = args[args.length - 1]
        const mockSpan: Partial<Span> = {
          spanContext: () => ({}) as SpanContext,
          setAttribute: vi.fn(),
          setAttributes: vi.fn(),
          addEvent: vi.fn(),
          setStatus: vi.fn(),
          updateName: vi.fn(),
          end: vi.fn(),
          isRecording: () => true,
          recordException: vi.fn(),
          addLink: vi.fn(),
          addLinks: vi.fn(),
        }
        return fn(mockSpan as Span)
      }),
    }
  }

  describe('startActiveSpan', () => {
    test('should delegate to underlying tracer', () => {
      const mockTracer = createMockTracer()
      const tracerWrapper = new TracerWrapper(mockTracer, 'test-prefix')

      const result = tracerWrapper.startActiveSpan('my-span', (span) => {
        expect(span).toBeDefined()
        return 'wrapped-result'
      })

      expect(result).toBe('wrapped-result')
      expect(mockTracer.startActiveSpan).toHaveBeenCalled()
    })

    test('should pass span name to underlying tracer', () => {
      const mockTracer = createMockTracer()
      const tracerWrapper = new TracerWrapper(mockTracer, 'prefix')

      tracerWrapper.startActiveSpan('operation-name', (span) => {
        return null
      })

      expect(mockTracer.startActiveSpan).toHaveBeenCalledWith('operation-name', {}, expect.any(Function))
    })
  })

  describe('startActiveSpanWithOptions', () => {
    test('should delegate to underlying tracer with options', () => {
      const mockTracer = createMockTracer()
      const tracerWrapper = new TracerWrapper(mockTracer, 'test-prefix')
      const options: SpanOptions = { kind: SpanKind.SERVER }

      const result = tracerWrapper.startActiveSpanWithOptions('my-span', options, (span) => {
        expect(span).toBeDefined()
        return 'result-with-options'
      })

      expect(result).toBe('result-with-options')
      expect(mockTracer.startActiveSpan).toHaveBeenCalledWith('my-span', options, expect.any(Function))
    })

    test('should work with complex span options', () => {
      const mockTracer = createMockTracer()
      const tracerWrapper = new TracerWrapper(mockTracer, 'prefix')
      const options: SpanOptions = {
        kind: SpanKind.INTERNAL,
        attributes: {
          'code.function': 'myFunction',
          'code.namespace': 'myNamespace',
        },
      }

      tracerWrapper.startActiveSpanWithOptions('complex-span', options, (span) => {
        // Should have access to the span
        expect(span.isRecording()).toBe(true)
        return 'complex-result'
      })

      expect(mockTracer.startActiveSpan).toHaveBeenCalledWith('complex-span', options, expect.any(Function))
    })

    test('should handle async operations', async () => {
      const mockTracer = createMockTracer()
      const tracerWrapper = new TracerWrapper(mockTracer, 'prefix')

      const result = await tracerWrapper.startActiveSpanWithOptions('async-span', {}, async (span) => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        return 'async-done'
      })

      expect(result).toBe('async-done')
    })
  })

  describe('tracer property', () => {
    test('should expose underlying tracer', () => {
      const mockTracer = createMockTracer()
      const tracerWrapper = new TracerWrapper(mockTracer, 'prefix')

      expect(tracerWrapper.tracer).toBe(mockTracer)
    })
  })
})

describe('VoidTracer instance', () => {
  test('voidTracer should be an instance of VoidTracer', () => {
    expect(voidTracer).toBeInstanceOf(VoidTracer)
  })
})
