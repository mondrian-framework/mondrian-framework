import { createSdk } from '@mondrian/sdk'
import m from '@mondrian/module'
import module from './module'
import { createGraphQLError } from 'graphql-yoga'

async function main() {
  const { address, ms } = await m.start({
    module,
    configuration: { MONGODB_URL: 'mock', STARTING_ID: 1 },
    options: {
      port: 4000,
      introspection: true,
      healthcheck: true,
      graphql: {
        logger: true,
        async errorHandler({ error, operationId }) {
          if (error instanceof Error) {
            return { error: createGraphQLError(error.message, { extensions: { operationId } }) }
          }
          return { error: createGraphQLError(`Internal server error ${operationId}`) } //hide details
        },
      },
      http: {
        logger: true,
        async errorHandler({ operationId }) {
          return { response: `Internal server error ${operationId}`, statusCode: 500 } //hide details
        },
      },
    },
  })
  console.log(`Module "${module.name}" has started in ${ms} ms! ${address}`)
}

async function sdkExample() {
  const sdk = createSdk({ module, endpoint: 'http://127.0.0.1:4000' })
  for (let i = 0; i < 1; i++) {
    try {
      const ins = await sdk.mutation.register({
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
      const result = await sdk.query.users({
        input: null,
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
