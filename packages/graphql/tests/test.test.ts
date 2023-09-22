import { graphql } from '../src'
import { result, types } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'
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

const exampleModule = module.build({
  name: 'example module',
  version: '1.0.0',
  functions: {
    asd: functions.build({
      input: types.number(),
      output: types.string(),
      error: types.never(),
      async body() {
        return result.ok('a')
      },
    }),
  },
  context: async () => ({}),
})

test.concurrent('typeToGqlType', () => {
  //const schema = graphql.fromModule({
  //  module: exampleModule,
  //  api: {
  //    functions: {
  //      asd: [{ type: 'query', name: 'a' }],
  //    },
  //  },
  //  context: async () => {},
  //  setHeader: () => {},
  //})
  // expect(1).toBe(2)
})

test('a', () => {
  const optionalInt = types.union({ some: types.number(), none: types.unknown() }).setName('optional_int')
  const t = getNamedType(graphql.typeToGraphQLType(optionalInt))

  console.log(
    printSchema(
      new GraphQLSchema({
        types: [t],
      }),
    ),
  )
  expect(1).toBe(2)
})
