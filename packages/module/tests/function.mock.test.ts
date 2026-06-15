import { functions } from '../src'
import { model } from '@mondrian-framework/model'
import { describe, expect, test } from 'vitest'

describe('createMockedFunction', () => {
  test('mock with errorProbability=0 returns ok result', async () => {
    const f = functions.define({
      input: model.string(),
      output: model.string(),
      errors: { notFound: model.string() },
    })
    const mocked = f.mock({ errorProbability: 0 })
    const args = {
      input: 'hello',
      retrieve: undefined as any,
      logger: undefined as any,
      tracer: undefined as any,
      functionName: 'mocked',
    }
    const res = await mocked.body(args as any)
    expect(res.isOk).toBe(true)
  })

  test('mock with errorProbability=1 returns failure result when errors are defined', async () => {
    const f = functions.define({
      input: model.string(),
      output: model.string(),
      errors: { notFound: model.string(), unauthorized: model.string() },
    })
    const mocked = f.mock({ errorProbability: 1 })
    const args = {
      input: 'hello',
      retrieve: undefined as any,
      logger: undefined as any,
      tracer: undefined as any,
      functionName: 'mocked',
    }
    const res = await mocked.body(args as any)
    expect(res.isFailure).toBe(true)
    if (res.isFailure) {
      const errorKeys = Object.keys(res.error)
      expect(errorKeys.length).toBe(1)
      expect(['notFound', 'unauthorized']).toContain(errorKeys[0])
    }
  })

  test('mock with errorProbability=1 still returns ok if no errors defined', async () => {
    const f = functions.define({
      input: model.string(),
      output: model.string(),
    })
    const mocked = f.mock({ errorProbability: 1 })
    const args = {
      input: 'hello',
      retrieve: undefined as any,
      logger: undefined as any,
      tracer: undefined as any,
      functionName: 'mocked',
    }
    const res = await mocked.body(args as any)
    expect(res.isOk).toBe(true)
  })

  test('mock without options returns ok result', async () => {
    const f = functions.define({
      input: model.string(),
      output: model.number(),
    })
    const mocked = f.mock()
    const args = {
      input: 'hello',
      retrieve: undefined as any,
      logger: undefined as any,
      tracer: undefined as any,
      functionName: 'mocked',
    }
    const res = await mocked.body(args as any)
    expect(res.isOk).toBe(true)
  })

  test('mock supports maxDepth option', async () => {
    const recursive = () =>
      model.object({
        value: model.string(),
        child: model.optional(recursive),
      })
    const f = functions.define({
      input: model.string(),
      output: recursive,
    })
    const mocked = f.mock({ errorProbability: 0, maxDepth: 1 })
    const args = {
      input: 'hello',
      retrieve: undefined as any,
      logger: undefined as any,
      tracer: undefined as any,
      functionName: 'mocked',
    }
    const res = await mocked.body(args as any)
    expect(res.isOk).toBe(true)
  })

  test('mock includes the original interface fields', () => {
    const input = model.string().setName('Input')
    const output = model.number().setName('Output')
    const f = functions.define({
      input,
      output,
    })
    const mocked = f.mock()
    expect(mocked.input).toBe(input)
    expect(mocked.output).toBe(output)
    expect(mocked.providers).toEqual({})
    expect(mocked.guards).toEqual({})
  })
})
