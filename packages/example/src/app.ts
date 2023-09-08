import { opentelemetry } from './opentelemetry'
import { rest } from './rest'
import { fastify } from 'fastify'

async function main() {
  opentelemetry.setup(rest.redditModule.name, rest.redditModule.version)
  const server = fastify()
  rest.startServer(server)
  const address = await server.listen({ port: 4000 })
  console.log(`Server started at address ${address}`)
}

main().then()
