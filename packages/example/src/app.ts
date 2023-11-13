import { serveGraphql } from './api/graphql'
import { serveRest } from './api/rest'
import { fastify } from 'fastify'

//Entry point of the application
async function main() {
  const server = fastify()
  const startTime = new Date().getTime()
  serveRest(server)
  const partialTime = new Date().getTime()
  serveGraphql(server)
  const finishTime = new Date().getTime()
  const address = await server.listen({ port: 4000 })
  console.log(`Rest    server started in ${partialTime - startTime}ms -> ${address}/openapi`)
  console.log(`Graphql server started in ${finishTime - partialTime}ms -> ${address}/graphql`)

  process.on('SIGINT', () => {
    console.log('Shutting down server...')
    server.close().then(() => {
      process.exit(0)
    })
  })
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
