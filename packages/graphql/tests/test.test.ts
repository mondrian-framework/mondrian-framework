import { graphql } from '../src'
import { types } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'
import { expect, test } from 'vitest'

const exampleModule = module.build({
  name: 'example module',
  version: '1.0.0',
  functions: {
    asd: functions.build({
      input: types.number(),
      output: types.string(),
      async body() {
        return 'a'
      },
    }),
  },
  context: async () => ({}),
})

test.concurrent('typeToGqlType', () => {
  const schema = graphql.fromModule({
    module: exampleModule,
    api: {
      functions: {
        asd: [{ type: 'query', name: 'a' }],
      },
    },
    context: async () => {},
    setHeader: () => {},
  })

  expect(1).toBe(2)
})
