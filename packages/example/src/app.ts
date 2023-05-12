import { module } from './module'
import { fastify } from 'fastify'
import { serve as serveRest } from '@mondrian/rest'
import { serve as serveGraphql } from '@mondrian/graphql'
import { GRAPHQL_API, REST_API } from './api'
import { sdkExample } from './client'

const db = new Map<string, any>()

async function main() {
  const server = fastify()
  const time = new Date().getTime()
  const context = async () => ({ db, startingId: 1 })
  await serveRest({ server, module, api: REST_API, context })
  await serveGraphql({ server, module, api: GRAPHQL_API, context })
  const address = await server.listen({ port: 4000 })
  console.log(`Module "${module.name}" has started in ${new Date().getTime() - time} ms! ${address}`)

  //await sdkExample()
}

main().then()
