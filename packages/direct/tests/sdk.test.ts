import { fromModule } from '../src/handler'
import { build } from '../src/sdk'
import { model } from '@mondrian-framework/model'
import { functions, module, retrieve } from '@mondrian-framework/module'
import { expect, test, describe } from 'vitest'

const ping = functions.build({
  input: model.number(),
  output: model.number(),
  async body(args) {
    return args.input
  },
})

const getUsers = functions.build({
  input: model.never(),
  output: model.entity({ name: model.string() }),
  retrieve: { select: true },
  async body(args) {
    return args.input
  },
})

const m = module.build({
  name: 'test',
  version: '0.0.1',
  async context() {
    return {}
  },
  functions: { ping, getUsers },
})

const handler = fromModule({
  module: m,
  async context(metadata, request) {
    return {}
  },
})
const client = build({ endpoint: handler, module: m })

describe('direct sdk', () => {
  test('callign a function with no errors, no retrieve, should work', async () => {
    const r1 = await client.functions.ping(123)
    expect(r1).toBe(123)
  })

  test('callign a function with no errors, no retrieve but WRONG INPUT should fail', async () => {
    await expect(() => client.functions.ping('abc' as any)).rejects.toThrow('Error while decoding request')
  })
})
