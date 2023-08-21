import { CRON_API, REST_API } from './api'
import { m as module } from './module'
import { cron } from '@mondrian-framework/cron'
import { server as restServer } from '@mondrian-framework/rest-fastify'
import { fastify } from 'fastify'

async function main() {
  const server = fastify()
  const time = new Date().getTime()
  restServer.start({
    server,
    module,
    api: REST_API,
    context: async ({ fastify }) => {
      return { jwt: fastify.request.headers.authorization }
    },
    async error({ error, log, functionName }) {
      if (error instanceof Error) {
        log(error.message)
        if (functionName === 'login') {
          return { status: 400, body: 'Unauthorized' }
        }
        return { status: 400, body: 'Bad request' }
      }
    },
  })
  /* graphql.serve({
    server,
    module,
    api: GRAPHQL_API,
    context: async ({ fastify }) => {
      return { jwt: fastify.request.headers.authorization }
    },
    async error({ error, fastify, log, functionName }) {
      if (error instanceof Error) {
        log(error.message)
        return { message: 'Invalid JWT' }
      }
    },
  })*/
  cron.start({
    module,
    api: CRON_API,
    context: async ({}) => ({}),
  })
  const address = await server.listen({ port: 4000 })
  console.log(`Module "${module.name}" has started in ${new Date().getTime() - time} ms! ${address}`)
}

main().then()
