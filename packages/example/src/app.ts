import { rest, graphql } from './api'
import { module } from './core'
import { opentelemetry } from './opentelemetry'
import { fastify } from 'fastify'

async function main() {
  opentelemetry.setup(module.instance.name, module.instance.version)
  const server = fastify()
  const startTime = new Date().getTime()
  const startMemory = process.memoryUsage().heapUsed
  rest.startServer(server)
  const partialTime = new Date().getTime()
  const partialMemory = process.memoryUsage().heapUsed
  graphql.startServer(server)
  const finishTime = new Date().getTime()
  const finishMemory = process.memoryUsage().heapUsed
  const address = await server.listen({ port: 4000 })
  console.log(
    `Rest    server started in ${partialTime - startTime}ms using ${Math.round(
      (partialMemory - startMemory) / 1024,
    )} KB -> ${address}/api`,
  )
  console.log(
    `Graphql server started in ${finishTime - partialTime}ms using ${Math.round(
      (finishMemory - partialMemory) / 1024,
    )} KB -> ${address}/graphql`,
  )
}

main().then()
