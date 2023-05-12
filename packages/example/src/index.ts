import { module } from './module'
import { fastify } from 'fastify'
import { createRestSdk, exposeModuleAsREST } from '@mondrian/rest'
import { exposeModuleAsGraphQL } from '@mondrian/graphql'

async function main() {
  const server = fastify()
  const time = new Date().getTime()
  await exposeModuleAsREST({
    server,
    module,
    rest: {
      api: {
        register: { method: 'POST' },
        user: { method: 'GET' },
        users: { method: 'GET' },
      },
      options: { introspection: true },
    },
  })
  await exposeModuleAsGraphQL({
    server,
    module,
    graphql: {
      api: {
        register: { type: 'mutation' },
        user: { type: 'query' },
        users: { type: 'query' },
      },
      options: { introspection: true },
    },
  })
  const address = await server.listen({ port: 4000 })
  console.log(`Module "${module.name}" has started in ${new Date().getTime() - time} ms! ${address}`)
}

async function sdkExample() {
  const sdk = createRestSdk({
    module,
    endpoint: 'http://127.0.0.1:4000',
    rest: {
      api: {
        register: { method: 'POST' },
        user: { method: 'GET' },
        users: { method: 'GET' },
      },
      options: { introspection: true },
    },
  })
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

  //example of another app using this module implementation
  //the module is not served but only used
  //const sdk = m.sdk({ module: EXPORTS.module, configuration: { MONGODB_URL: 'mock', STARTING_ID: 1 } })
}

main().then(() => sdkExample().then())
