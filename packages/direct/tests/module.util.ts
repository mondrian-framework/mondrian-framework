import { model, result } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'

const ping = functions.build({
  input: model.number(),
  output: model.number(),
  async body(args) {
    if (args.input < 0 && !Number.isInteger(args.input)) {
      throw 'Not integer ping'
    }
    if (args.input < 0) {
      throw new Error('Negative ping')
    }
    return args.input
  },
})

const divideBy = functions.build({
  input: model.object({ dividend: model.number(), divisor: model.number() }),
  output: model.number(),
  errors: { dividingByZero: model.string() },
  async body({ input: { dividend, divisor } }) {
    if (divisor === 0) {
      return result.fail({ dividingByZero: 'divisor is 0' })
    }
    return result.ok(dividend / divisor)
  },
})

const getUsers = functions.build({
  input: model.never(),
  output: model.entity({ name: model.string() }).array(),
  retrieve: { select: true },
  async body() {
    return [{ name: 'John' }]
  },
})

export const m = module.build({
  name: 'test',
  version: '0.0.1',
  async context() {
    return {}
  },
  functions: { ping, getUsers, divideBy },
})
