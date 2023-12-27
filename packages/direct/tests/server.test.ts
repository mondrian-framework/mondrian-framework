import { build } from '../src/sdk'
import { serveWithFastify } from '../src/server/fastify'
import { m as module } from './module.util'
import { fastify } from 'fastify'
import { expect, test } from 'vitest'

test('fastify server', async () => {
  const server = fastify()
  serveWithFastify({
    server,
    module,
    async context(serverContext, metadata) {
      return {}
    },
  })
  const address = await server.listen({ port: 1234 })

  const client = build({ endpoint: `${address}/mondrian`, module })
  const r1 = await client.functions.ping(123)
  expect(r1).toBe(123)

  const r2 = await fetch(`${address}/mondrian`, { redirect: 'manual' })
  expect(r2.status).toBe(302)
  await server.close()
})
