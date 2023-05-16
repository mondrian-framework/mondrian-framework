import { module } from './module'
import { fastify } from 'fastify'
import { serve as serveRest } from '@mondrian/rest'
import { serve as serveGraphql } from '@mondrian/graphql'
import { listen as listenSqs } from '@mondrian/aws-sqs'
import { cron } from '@mondrian/cron'
import { CRON_API, GRAPHQL_API, REST_API, SQS_API } from './api'
import { localSdkExample } from './local-client'
import { remoteSdkExample } from './remote-client'
import { sleep } from '@mondrian/utils'

async function main() {
  const server = fastify()
  const time = new Date().getTime()
  serveRest({
    server,
    module,
    api: REST_API,
    context: async ({ request }) => ({ token: request.headers.authorization }),
  })
  serveGraphql({
    server,
    module,
    api: GRAPHQL_API,
    context: async ({ request }) => ({ token: request.headers.authorization }),
  })
  const closer = listenSqs({
    module,
    api: SQS_API,
    context: async ({ message }) => ({ token: message.Attributes?.token }),
  })
  const cronHandler = cron({
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
