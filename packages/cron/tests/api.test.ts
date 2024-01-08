import { start } from '../src'
import { build } from '../src/api'
import { model, result } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'
import { test } from 'vitest'

test('cron API test', async () => {
  const f1 = functions
    .define({
      output: model.number(),
    })
    .implement({
      async body() {
        return result.ok(1)
      },
    })

  const f2 = functions
    .define({
      input: model.number(),
      output: model.number(),
    })
    .implement({
      async body({ input }) {
        return result.ok(input + 1)
      },
    })

  const f3 = functions
    .define({
      input: model.number().optional(),
      output: model.number(),
    })
    .implement({
      async body({ input }) {
        return result.ok(input ?? 1 + 1)
      },
    })

  const m = module.build({
    name: 'test',
    functions: { f1, f2, f3 },
    async context() {
      return result.ok({})
    },
  })

  const cronApi = build({
    module: m,
    functions: {
      f1: {
        cron: '* * * * *',
      },
      f2: {
        cron: '* * * * *',
        async input() {
          return 1
        },
      },
      f3: {
        cron: '* * * * *',
      },
    },
  })

  const cronServer = start({ api: cronApi, context: async () => ({}) })
  await cronServer.close()
})
