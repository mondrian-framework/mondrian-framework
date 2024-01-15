import { serveDirect } from './api/direct'
import { serveGraphql } from './api/graphql'
import { serveRest } from './api/rest'
import cors from '@fastify/cors'
import { fastify } from 'fastify'

//Entry point of the application
async function main() {
  const server = fastify()
  await server.register(cors, { origin: '*' })
  const startTime = new Date().getTime()
  serveRest(server)
  const partialTime1 = new Date().getTime()
  serveGraphql(server)
  const partialTime2 = new Date().getTime()
  serveDirect(server)
  const finishTime = new Date().getTime()
  const address = await server.listen({ port: 4000 })
  console.log(`Rest    server started in ${partialTime1 - startTime}ms -> ${address}/openapi`)
  console.log(`Graphql server started in ${partialTime2 - partialTime1}ms -> ${address}/graphql`)
  console.log(`Direct  server started in ${finishTime - partialTime2}ms -> ${address}/mondrian`)
}

main()
  .then()
  .catch((error) => {
    if (error instanceof Error) {
      console.error(`Program failed with an unexpected error: ${error.message}`)
    } else {
      console.error(`Program failed with an unexpected error: ${JSON.stringify(error)}`)
    }
    process.exit(1)
  })
