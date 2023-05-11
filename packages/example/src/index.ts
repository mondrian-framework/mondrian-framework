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

main().then()
