import { module } from './module'
import { fastify } from 'fastify'
import { serve as serveRest } from '@mondrian/rest'
import { serve as serveGraphql } from '@mondrian/graphql'
import { GRAPHQL_API, REST_API, SQS_API } from './api'
import { localSdkExample } from './local-client'
import { remoteSdkExample } from './remote-client'
import { listen as listenSqs } from '@mondrian/aws-sqs'
import { sleep } from '@mondrian/utils'

const db = new Map<string, any>()

async function main() {
  const server = fastify()
  const time = new Date().getTime()
  const context = async () => ({ db, startingId: 1 })
  serveRest({ server, module, api: REST_API, context })
  serveGraphql({ server, module, api: GRAPHQL_API, context })
  const closer = listenSqs({ module, api: SQS_API, context })
  const address = await server.listen({ port: 4000 })
  console.log(`Module "${module.name}" has started in ${new Date().getTime() - time} ms! ${address}`)

  //await localSdkExample(db)
  //await remoteSdkExample()
  //await sleep(60000)
  //await server.close()
  //await closer.close()
}

main().then()
