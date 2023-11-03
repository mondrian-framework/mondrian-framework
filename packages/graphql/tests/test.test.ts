import { graphql } from '../src'
import { fromModule } from '../src/graphql'
import { result, types } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'
import fs from 'fs'
import {
  printSchema,
  GraphQLSchema,
  GraphQLNamedType,
  GraphQLObjectType,
  GraphQLString,
  GraphQLList,
  GraphQLNonNull,
  getNamedType,
} from 'graphql'
import { expect, test } from 'vitest'

test('main', () => {
  const model = () =>
    types
      .entity({
        id: types.string(),
        name: types.string(),
        friends: types.optional(types.array(model)),
      })
      .setName('User')

  const prova = functions.withContext<{}>().build({
    input: model,
    output: model,
    errors: undefined,
    retrieve: { where: true },
    body: async () => ({ id: 'a', name: 'a' }),
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
  const schemaPrinted = printSchema(schema)
  fs.writeFileSync('schema.graphql', schemaPrinted, {})
  console.log(schemaPrinted)
})
