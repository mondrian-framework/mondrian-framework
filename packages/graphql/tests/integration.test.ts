import { afterAll, describe, expect, test } from 'vitest'
import { fromModule } from '../src/graphql'
import { createYoga } from 'graphql-yoga'
import http from 'node:http'
import { functions, module } from '@mondrian-framework/module'
import { model } from '@mondrian-framework/model'
import { build } from '../src/api'

const addOne = functions.build({
  input: model.number(),
  output: model.number(),
  body: async ({ input }) => {
    return input + 1
  },
})

const m = module.build({
  name: 'test',
  version: '1.0.0',
  options: { maxSelectionDepth: 2 },
  functions: { addOne },
  context: async () => ({}),
})

type ServerContext = { req: http.IncomingMessage; res: http.ServerResponse }

const schema = fromModule({
  api: build({
    module: m,
    functions: {
      addOne: { type: 'query', name: 'addOne' },
    },
  }),
  context: async (_: ServerContext) => ({}),
  setHeader: (ctx, name, value) => ctx.res.setHeader(name, value),
})

const yoga = createYoga<ServerContext>({ schema })

describe('graphql', () => {
  const server = http.createServer(yoga)
  server.listen(50124)
  test('simple module', async () => {
    const res = await fetch('http://127.0.0.1:50124/graphql', { method: 'get' })
    expect(res.status).toBe(200)
    const res2 = await makeRequest('query { addOne(input: 2) }')
    expect(res2.status).toBe(200)
    expect(res2.body).toEqual({ data: { addOne: 3 } })
  })

  afterAll(() => {
    server.close()
  })
})

async function makeRequest(query: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch('http://127.0.0.1:50124/graphql', {
    method: 'post',
    body: JSON.stringify({ query }),
    headers: { 'Content-Type': 'application/json' },
  })
  return { status: res.status, body: await res.json() }
}
