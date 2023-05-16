import { module } from './module'
import { fastify } from 'fastify'
import rest from '@mondrian/rest'
import graphql from '@mondrian/graphql'
import sqs from '@mondrian/aws-sqs'
import cron from '@mondrian/cron'
import { CRON_API, GRAPHQL_API, REST_API, SQS_API } from './api'
import { localSdkExample } from './local-client'
import { remoteSdkExample } from './remote-client'
import { sleep } from '@mondrian/utils'

async function main() {
  const server = fastify()
  const time = new Date().getTime()
  rest.serve({
    server,
    module,
    api: REST_API,
    context: async ({ request }) => ({ token: request.headers.authorization }),
  })
  graphql.serve({
    server,
    module,
    api: GRAPHQL_API,
    context: async ({ request }) => ({ token: request.headers.authorization }),
  })
  const closer = sqs.listen({
    module,
    api: SQS_API,
    context: async ({ message }) => ({ token: message.Attributes?.token }),
  })
  const cronHandler = cron.start({
    module,
    api: CRON_API,
    context: async ({}) => ({}),
  })
  const address = await server.listen({ port: 4000 })
  console.log(`Module "${module.name}" has started in ${new Date().getTime() - time} ms! ${address}`)

  //await localSdkExample(db)
  await remoteSdkExample()

  /*
  await sleep(10000)
  await cronHandler.close()
  await server.close()
  await closer.close()
  */
}

main().then()
