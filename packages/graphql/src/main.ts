import { fromModule } from './graphql'
import { types } from '@mondrian-framework/model'
import { functions } from '@mondrian-framework/module'
import { printSchema } from 'graphql'

async function main() {
  const model = types
    .entity({
      id: types.string(),
      name: types.number(),
    })
    .setName('input')

  const prova = functions.withContext<{}>().build({
    input: model,
    output: model,
    errors: undefined,
    retrieve: { select: true },
    body: async () => ({ id: 'a', name: 1 }),
    options: { namespace: 'post' },
  })

  const schema = fromModule({
    module: {
      name: 'string',
      version: 'string',
      functions: { prova },
      context: async () => ({}),
    },
    api: {
      functions: {
        prova: { type: 'mutation' },
      },
    },
    context: async () => ({}),
    setHeader: () => {},
  })

  console.log(printSchema(schema))
}

main().then()
