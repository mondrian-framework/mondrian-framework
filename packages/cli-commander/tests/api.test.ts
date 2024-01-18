import { cli } from '../src'
import { result, model } from '@mondrian-framework/model'
import { module, functions } from '@mondrian-framework/module'
import { expect, test } from 'vitest'

const ping = functions
  .define({
    input: model.string(),
    output: model.string().optional(),
    errors: { e1: model.string() },
  })
  .implement({
    async body({ input }) {
      if (input !== 'ping') {
        return result.fail({ e1: 'Not a ping' })
      } else {
        return result.ok('pong')
      }
    },
  })

const double = functions
  .define({
    input: model.number().optional(),
    output: model.number().optional(),
  })
  .implement({
    async body({ input }) {
      if (input) {
        return result.ok(input * 2)
      }
      return result.ok()
    },
  })

const register = functions
  .define({
    input: model.object({ 'user-name': model.string().optional(), password: model.string() }),
    output: model.string(),
  })
  .implement({
    async body({ input }) {
      if (input.password.length < 3) {
        throw new Error('Too short')
      }
      return result.ok('ok')
    },
  })
const m = module.build({
  name: 'test',
  description: 'test',
  functions: { ping, register, register2: register, double },
})

test('cli-test', async () => {
  let res: result.Result<unknown, unknown> = result.fail(null) as result.Result<unknown, unknown>
  const prg = cli.fromModule({
    async context() {
      return {}
    },
    functions: {
      ping: [
        { commandName: 'ping', inputBindingStyle: 'single-json' },
        { commandName: 'ping2', inputBindingStyle: 'argument-spreaded' },
      ],
      register: [{ commandName: 'register' }, { commandName: 'register2', inputBindingStyle: 'argument-spreaded' }],
      double: {},
      register2: undefined,
    },
    module: m,
    async output(r) {
      res = r
    },
    programVersion: '1.0.0',
  })
  await prg.parseAsync(['ping', 'asd'], { from: 'user' })
  expect(res.isFailure && res.error).toEqual({ e1: 'Not a ping' })
  await prg.parseAsync(['ping2', 'ping'], { from: 'user' })
  expect(res.isOk && res.value).toEqual('pong')
  await prg.parseAsync(['register', '{"user-name":"user", "password":"pass"}'], { from: 'user' })
  expect(res.isOk && res.value).toEqual('ok')
  await prg.parseAsync(['register', '{"user-name":"user", "password2":"pass"}'], { from: 'user' })
  expect(res.isFailure && res.error).toEqual([{ expected: 'string', got: undefined, path: '$.password' }])
  await prg.parseAsync(['register2', '--user-name', 'user', '--password', 'pass'], { from: 'user' })
  expect(res.isOk && res.value).toEqual('ok')
  await prg.parseAsync(['register2', '--user-name', 'user', '--password', 'a'], { from: 'user' })
  expect(res.isFailure && res.error).toEqual(new Error('Too short'))
  await prg.parseAsync(['double'], { from: 'user' })
  expect(res.isOk && res.value).toEqual(undefined)
})
