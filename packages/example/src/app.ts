import { module } from './module'
import { fastify } from 'fastify'
import rest from '@mondrian/rest'
import graphql from '@mondrian/graphql'
import cron from '@mondrian/cron'
import { CRON_API, GRAPHQL_API, REST_API } from './api'

async function main() {
  const server = fastify()
  const time = new Date().getTime()
  rest.serve({
    server,
    module,
    api: REST_API,
    context: async ({ request }) => {
      return { jwt: request.headers.authorization }
    },
  })
  graphql.serve({
    server,
    module,
    api: GRAPHQL_API,
    context: async ({ request }) => {
      return { jwt: request.headers.authorization }
    },
  })
  cron.start({
    module,
    api: CRON_API,
    context: async ({}) => ({}),
  })
  const address = await server.listen({ port: 4000 })
  console.log(`Module "${module.name}" has started in ${new Date().getTime() - time} ms! ${address}`)
}

main().then()
