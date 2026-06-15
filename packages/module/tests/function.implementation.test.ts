import { functions, module, client as clientBuilder, provider, error, logger as moduleLogger } from '../src'
import { result, model } from '@mondrian-framework/model'
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

describe('OpentelemetryFunction apply paths', () => {
  let spanExporter: InMemorySpanExporter
  let provider1: NodeTracerProvider

  beforeAll(() => {
    spanExporter = new InMemorySpanExporter()
    provider1 = new NodeTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(spanExporter)],
    })
    provider1.register()
  })

  afterAll(async () => {
    await provider1.shutdown()
  })

  test('records spans when providers fail (apply path)', async () => {
    spanExporter.reset()
    const failingProvider = provider.build({
      errors: { unauthorized: model.string() },
      async body() {
        return result.fail({ unauthorized: 'no auth' })
      },
    })
    const f = functions
      .define({
        input: model.string(),
        output: model.string(),
        errors: { unauthorized: model.string() },
      })
      .use({ providers: { auth: failingProvider } })
      .implement({
        async body() {
          return result.ok('ok')
        },
      })
    const m = module.build({
      name: 'test',
      functions: { f },
      options: { opentelemetry: true },
    })
    const client = clientBuilder.build({
      module: m,
      async context() {
        return {}
      },
    })
    const res = await client.functions.f('hi')
    expect(res.isFailure).toBe(true)
    if (res.isFailure) {
      expect(res.error).toEqual({ unauthorized: 'no auth' })
    }
    const spans = spanExporter.getFinishedSpans()
    expect(spans.length).toBeGreaterThan(0)
    // At least one provision span should be marked as error.
    const provisionSpan = spans.find((s) => s.name.includes('provision'))
    expect(provisionSpan).toBeDefined()
    expect(provisionSpan!.status.code).toBe(2 /* SpanStatusCode.ERROR */)
  })

  test('records spans when body throws (apply tracing error path)', async () => {
    spanExporter.reset()
    const f = functions
      .define({
        input: model.string(),
        output: model.string(),
      })
      .implement({
        async body() {
          throw new Error('Body failure')
        },
      })
    const m = module.build({
      name: 'test',
      functions: { f },
      options: { opentelemetry: true },
    })
    const client = clientBuilder.build({
      module: m,
      async context() {
        return {}
      },
    })
    await expect(client.functions.f('hi')).rejects.toThrow('Body failure')
    const spans = spanExporter.getFinishedSpans()
    const applySpan = spans.find((s) => s.name.includes('apply'))
    expect(applySpan).toBeDefined()
    expect(applySpan!.status.code).toBe(2 /* SpanStatusCode.ERROR */)
  })

  test('addErrorsToSpanAttribute short-circuits when errors is undefined', async () => {
    spanExporter.reset()
    // Function returns failure without declared errors → addErrorsToSpanAttribute should short-circuit.
    const f = functions
      .define({
        input: model.string(),
        output: model.string(),
      })
      .implement({
        async body() {
          return result.fail(undefined as never)
        },
      })
    const m = module.build({
      name: 'test',
      functions: { f },
      options: { opentelemetry: true, checkOutputType: 'ignore' },
    })
    const client = clientBuilder.build({
      module: m,
      async context() {
        return {}
      },
    })
    // Module without errors throws "Unexpected failure" because client wraps it.
    await expect(client.functions.f('hi')).rejects.toThrow()
    const spans = spanExporter.getFinishedSpans()
    expect(spans.length).toBeGreaterThan(0)
  })

  test('encodes errors into span attribute when failure occurs', async () => {
    spanExporter.reset()
    const f = functions
      .define({
        input: model.string(),
        output: model.string(),
        errors: { invalid: model.object({ reason: model.string() }) },
      })
      .implement({
        async body() {
          return result.fail({ invalid: { reason: 'because' } })
        },
      })
    const m = module.build({
      name: 'test',
      functions: { f },
      options: { opentelemetry: true },
    })
    const client = clientBuilder.build({
      module: m,
      async context() {
        return {}
      },
    })
    const res = await client.functions.f('hi')
    expect(res.isFailure).toBe(true)
    const spans = spanExporter.getFinishedSpans()
    const applySpan = spans.find((s) => s.name.includes('apply'))
    expect(applySpan).toBeDefined()
    expect(applySpan!.attributes['error.json']).toBeDefined()
  })

  test('uses custom opentelemetry spanNamePrefix and attributes', async () => {
    spanExporter.reset()
    const f = functions
      .define({
        input: model.string(),
        output: model.string(),
      })
      .implement({
        async body({ input }) {
          return result.ok(input)
        },
      })
    const m = module.build({
      name: 'test',
      functions: { f },
      options: {
        opentelemetry: {
          spanNamePrefix: (name) => `custom-${name}`,
          attributes: () => ({ 'custom.attr': 'value' }),
        },
      },
    })
    const client = clientBuilder.build({
      module: m,
      async context() {
        return {}
      },
    })
    const res = await client.functions.f('hi')
    expect(res).toBe('hi')
    const spans = spanExporter.getFinishedSpans()
    expect(spans.some((s) => s.name.startsWith('custom-f'))).toBe(true)
    const applySpan = spans.find((s) => s.name === 'custom-f - apply')
    expect(applySpan).toBeDefined()
    expect(applySpan!.attributes['custom.attr']).toBe('value')
  })

  test('rawApply records bad-input span when input decode fails (no badInputErrorKey)', async () => {
    spanExporter.reset()
    const f = functions
      .define({
        input: model.object({ count: model.number() }),
        output: model.string(),
      })
      .implement({
        async body() {
          return result.ok('ok')
        },
      })
    const m = module.build({
      name: 'test',
      functions: { f },
      options: { opentelemetry: true },
    })
    const client = clientBuilder.build({
      module: m,
      async context() {
        return {}
      },
    })
    await expect(client.functions.f({ count: 'not-a-number' } as any)).rejects.toThrow()
    const spans = spanExporter.getFinishedSpans()
    expect(spans.length).toBeGreaterThan(0)
    const decodeSpan = spans.find((s) => s.name.includes('decode input'))
    expect(decodeSpan).toBeDefined()
    expect(decodeSpan!.status.code).toBe(2 /* SpanStatusCode.ERROR */)
  })

  test('OpentelemetryFunction rawApply returns BadInput failure when input decode fails and badInputErrorKey is defined', async () => {
    spanExporter.reset()
    const f = functions
      .define({
        input: model.object({ count: model.number() }),
        output: model.string(),
        errors: { badInput: error.standard.BadInput },
      })
      .implement({
        async body() {
          return result.ok('ok')
        },
      })
    const m = module.build({
      name: 'test',
      functions: { f },
      options: { opentelemetry: true },
    })
    const client = clientBuilder.build({
      module: m,
      async context() {
        return {}
      },
    })
    const res = await client.functions.f({ count: 'not-a-number' } as any)
    expect(res.isFailure).toBe(true)
    if (res.isFailure) {
      expect(res.error.badInput?.from).toBe('input')
    }
    const spans = spanExporter.getFinishedSpans()
    const decodeSpan = spans.find((s) => s.name.includes('decode input'))
    expect(decodeSpan).toBeDefined()
  })

  test('OpentelemetryFunction rawApply returns BadInput failure when retrieve decode fails and badInputErrorKey is defined', async () => {
    spanExporter.reset()
    const userType = () => model.entity({ id: model.number(), name: model.string() })
    const f = functions
      .define({
        input: model.string(),
        output: userType,
        retrieve: { select: true, take: true },
        errors: { badInput: error.standard.BadInput },
      })
      .implement({
        async body() {
          return result.ok({ id: 1, name: 'a' })
        },
      })
    const m = module.build({
      name: 'test',
      functions: { f },
      options: { opentelemetry: true },
    })
    const client = clientBuilder.build({
      module: m,
      async context() {
        return {}
      },
    })
    const res = await client.functions.f('test', { retrieve: { take: 'bad' } as any })
    expect(res.isFailure).toBe(true)
    if (res.isFailure) {
      expect(res.error.badInput?.from).toBe('retrieve')
    }
    const spans = spanExporter.getFinishedSpans()
    const decodeRetrieveSpan = spans.find((s) => s.name.includes('decode retrieve'))
    expect(decodeRetrieveSpan).toBeDefined()
  })

  test('BaseFunction throws InvalidInput when input decode fails and no badInputErrorKey', async () => {
    // No opentelemetry, no errors → uses BaseFunction. Bad input → throw.
    const f = functions
      .define({
        input: model.object({ count: model.number() }),
        output: model.string(),
      })
      .implement({
        async body() {
          return result.ok('ok')
        },
      })
    const m = module.build({
      name: 'test',
      functions: { f },
    })
    const client = clientBuilder.build({
      module: m,
      async context() {
        return {}
      },
    })
    await expect(client.functions.f({ count: 'not-a-number' } as any)).rejects.toThrow()
  })

  test('BaseFunction throws InvalidInput when retrieve decode fails and no badInputErrorKey', async () => {
    const userType = () => model.entity({ id: model.number(), name: model.string() })
    const f = functions
      .define({
        input: model.string(),
        output: userType,
        retrieve: { select: true, take: true },
      })
      .implement({
        async body() {
          return result.ok({ id: 1, name: 'a' })
        },
      })
    const m = module.build({
      name: 'test',
      functions: { f },
    })
    const client = clientBuilder.build({
      module: m,
      async context() {
        return {}
      },
    })
    await expect(client.functions.f('test', { retrieve: { take: 'bad' } as any })).rejects.toThrow()
  })

  test('OpentelemetryFunction decodes retrieve successfully and ends span', async () => {
    spanExporter.reset()
    const userType = () => model.entity({ id: model.number(), name: model.string() })
    const f = functions
      .define({
        input: model.string(),
        output: userType,
        retrieve: { select: true, take: true },
      })
      .implement({
        async body() {
          return result.ok({ id: 1, name: 'a' })
        },
      })
    const m = module.build({
      name: 'test',
      functions: { f },
      options: { opentelemetry: true },
    })
    const client = clientBuilder.build({
      module: m,
      async context() {
        return {}
      },
    })
    const res = await client.functions.f('hello', { retrieve: { take: 5, select: { name: true } } })
    expect(res).toEqual({ name: 'a' })
    const spans = spanExporter.getFinishedSpans()
    const decodeRetrieveSpan = spans.find((s) => s.name.includes('decode retrieve'))
    expect(decodeRetrieveSpan).toBeDefined()
    expect(decodeRetrieveSpan!.status.code).not.toBe(2 /* SpanStatusCode.ERROR */)
  })

  test('BaseFunction rawApply applies mapper.input and mapper.retrieve', async () => {
    const userType = () => model.entity({ id: model.number(), name: model.string() })
    const f = functions
      .define({
        input: model.string(),
        output: userType,
        retrieve: { select: true, take: true },
      })
      .implement({
        async body({ input, retrieve: r }) {
          expect(input).toBe('HELLO')
          expect(r?.take).toBe(99)
          return result.ok({ id: 1, name: input })
        },
      })
    const m = module.build({
      name: 'test',
      // No opentelemetry → BaseFunction is used.
      functions: { f },
      options: { checkOutputType: 'ignore' },
    })
    const fn = m.functions.f as any
    const res = await fn.rawApply({
      rawInput: 'hello',
      rawRetrieve: { take: 1 },
      contextInput: {},
      logger: moduleLogger.build({ moduleName: 'test', server: 'TEST' }),
      mapper: {
        input: (v: unknown) => (v as string).toUpperCase(),
        retrieve: (r: any) => ({ ...(r ?? {}), take: 99 }),
      },
    })
    expect(res.isOk).toBe(true)
  })

  test('OpentelemetryFunction rawApply applies mapper.input and mapper.retrieve', async () => {
    spanExporter.reset()
    const userType = () => model.entity({ id: model.number(), name: model.string() })
    const f = functions
      .define({
        input: model.string(),
        output: userType,
        retrieve: { select: true, take: true },
      })
      .implement({
        async body({ input, retrieve: r }) {
          // Verify mappers applied:
          // - input was upper-cased by mapper.input
          // - retrieve.take was overridden by mapper.retrieve
          expect(input).toBe('HELLO')
          expect(r?.take).toBe(99)
          return result.ok({ id: 1, name: input })
        },
      })
    const m = module.build({
      name: 'test',
      functions: { f },
      options: { opentelemetry: true, checkOutputType: 'ignore' },
    })
    const fn = m.functions.f as any
    const res = await fn.rawApply({
      rawInput: 'hello',
      rawRetrieve: { take: 1 },
      contextInput: {},
      logger: moduleLogger.build({ moduleName: 'test', server: 'TEST' }),
      mapper: {
        input: (v: unknown) => (v as string).toUpperCase(),
        retrieve: (r: any) => ({ ...(r ?? {}), take: 99 }),
      },
    })
    expect(res.isOk).toBe(true)
  })

  test('OpentelemetryFunction apply records non-Error throws without recordException', async () => {
    spanExporter.reset()
    // Throws a non-Error → covers the `if (error instanceof Error)` false branch on line 406.
    const f = functions
      .define({
        input: model.string(),
        output: model.string(),
      })
      .implement({
        async body() {
          // eslint-disable-next-line no-throw-literal
          throw 'plain string failure'
        },
      })
    const m = module.build({
      name: 'test',
      functions: { f },
      options: { opentelemetry: true },
    })
    const client = clientBuilder.build({
      module: m,
      async context() {
        return {}
      },
    })
    await expect(client.functions.f('hi')).rejects.toBe('plain string failure')
    const spans = spanExporter.getFinishedSpans()
    const applySpan = spans.find((s) => s.name.includes('apply'))
    expect(applySpan).toBeDefined()
    expect(applySpan!.status.code).toBe(2 /* SpanStatusCode.ERROR */)
    // No exception event should have been recorded since the thrown value wasn't an Error.
    expect(applySpan!.events.find((e) => e.name === 'exception')).toBeUndefined()
  })

  test('OpentelemetryFunction rawApply non-Error throw from mapper triggers outer catch with errorCatched=false (line 349 false branch)', async () => {
    spanExporter.reset()
    // mapper.input throws a non-Error before this.apply is invoked, so the outer catch
    // sees errorCatched=false and the `if (error instanceof Error)` branch goes false.
    const f = functions
      .define({
        input: model.string(),
        output: model.string(),
      })
      .implement({
        async body({ input }) {
          return result.ok(input)
        },
      })
    const m = module.build({
      name: 'test',
      functions: { f },
      options: { opentelemetry: true },
    })
    const fn = m.functions.f as any
    await expect(
      fn.rawApply({
        rawInput: 'x',
        rawRetrieve: {},
        contextInput: {},
        logger: moduleLogger.build({ moduleName: 'test', server: 'TEST' }),
        mapper: {
          input: () => {
            // eslint-disable-next-line no-throw-literal
            throw 'not-an-Error'
          },
        },
      }),
    ).rejects.toBe('not-an-Error')
    const spans = spanExporter.getFinishedSpans()
    // No exception event should have been recorded since the thrown value wasn't an Error.
    const allEvents = spans.flatMap((s) => s.events)
    expect(allEvents.find((e) => e.name === 'exception')).toBeUndefined()
  })

  test('rawApply records bad-retrieve span when retrieve decode fails', async () => {
    spanExporter.reset()
    const userType = () => model.entity({ id: model.number(), name: model.string() })
    const f = functions
      .define({
        input: model.string(),
        output: userType,
        retrieve: { select: true, take: true },
      })
      .implement({
        async body() {
          return result.ok({ id: 1, name: 'a' })
        },
      })
    const m = module.build({
      name: 'test',
      functions: { f },
      options: { opentelemetry: true },
    })
    const client = clientBuilder.build({
      module: m,
      async context() {
        return {}
      },
    })
    await expect(client.functions.f('test', { retrieve: { take: 'bad' } as any })).rejects.toThrow()
    const spans = spanExporter.getFinishedSpans()
    const decodeRetrieveSpan = spans.find((s) => s.name.includes('decode retrieve'))
    expect(decodeRetrieveSpan).toBeDefined()
    expect(decodeRetrieveSpan!.status.code).toBe(2 /* SpanStatusCode.ERROR */)
  })
})
