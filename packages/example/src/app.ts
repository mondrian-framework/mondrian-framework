import { module } from './core'
import { opentelemetry } from './opentelemetry'
import { rest } from './rest'
import { fastify } from 'fastify'

async function main() {
  opentelemetry.setup(module.instance.name, module.instance.version)
  const server = fastify()
  rest.startServer(server)
  const address = await server.listen({ port: 4000 })
  console.log(`Server started at address ${address}`)
}

main().then()
