import { module, sdk } from '../src'
import { types } from '@mondrian-framework/model'
import { expect, test } from 'vitest'

test('Whole module', async () => {
  const fb = module.functionBuilder<{}>({ namespace: 'test' })
  const UserType = () =>
    types
      .object({
        email: types.string(),
        password: types.string(),
        friends: types.array(UserType),
      })
      .setName('User')
  const login = fb({
    input: types.number(),
    output: UserType,
    async apply(args) {
      return { email: '', password: '', friends: [] }
    },
  })
  const functions = module.functions({ login })
  const m = module.define<{ ip: string }>()({
    name: 'Test',
    version: '1.0.0',
    functions: {
      definitions: functions,
    },
    async context({ ip }) {
      return {}
    },
  })

  const client = sdk.fromModule<{ ip?: string }>()({
    module: m,
    async context({ metadata }) {
      return { ip: metadata?.ip ?? 'local' }
    },
  })

  const asd = await client.login({
    input: 1,
  })
})
