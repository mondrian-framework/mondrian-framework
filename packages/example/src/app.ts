import { module } from './module'
import { fastify } from 'fastify'
import { createRestSdk, exposeModuleAsREST } from '@mondrian/rest'
import { exposeModuleAsGraphQL } from '@mondrian/graphql'
import { GRAPHQL_API, REST_API } from './api'

async function main() {
  const server = fastify()
  const time = new Date().getTime()
  await exposeModuleAsREST({ server, module, api: REST_API })
  await exposeModuleAsGraphQL({ server, module, api: GRAPHQL_API })
  const address = await server.listen({ port: 4000 })
  console.log(`Module "${module.name}" has started in ${new Date().getTime() - time} ms! ${address}`)
}

async function sdkExample() {
  const sdk = createRestSdk({ module, endpoint: 'http://127.0.0.1:4000', rest: REST_API })
  for (let i = 0; i < 1; i++) {
    try {
      const ins = await sdk.register({
        input: {
          credentials: { email: 'asd@gmail.com', password: '12345' },
          profile: { firstname: `Mario ${i}`, lastname: 'Bros' },
          type: 'CUSTOMER',
        },
        fields: {
          ProfessionalUser: { id: true, profile: true, type: true },
          CustomerUser: { id: true, type: true },
        },
        headers: { id: '1234' },
      })
      console.log(ins)
      const result = await sdk.users({
        input: {},
        fields: true,
        headers: { id: '1234' },
      })
      console.log(result)
    } catch (error) {
      if (error instanceof Error) {
        console.log(error.message)
      }
    }
  }
}

main().then(() => sdkExample().then())
