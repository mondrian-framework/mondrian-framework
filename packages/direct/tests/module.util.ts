import { build as buildApi } from '../src/api'
import { model, result } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'

const ping = functions
  .define({
    input: model.number(),
    output: model.number(),
  })
  .implement({
    async body(args) {
      if (args.input < 0 && !Number.isInteger(args.input)) {
        throw 'Not integer ping'
      }
      if (args.input < 0) {
        throw new Error('Negative ping')
      }
      return result.ok(args.input)
    },
  })

const divideBy = functions
  .define({
    input: model.object({ dividend: model.number(), divisor: model.number() }),
    output: model.number(),
    errors: { dividingByZero: model.string() },
  })
  .implement({
    async body({ input: { dividend, divisor } }) {
      if (divisor === 0) {
        return result.fail({ dividingByZero: 'divisor is 0' })
      }
      return result.ok(dividend / divisor)
    },
  })

const getUsers = functions
  .define({
    output: model.entity({ name: model.string() }).array(),
    retrieve: { select: true },
  })
  .implement({
    async body() {
      return result.ok([{ name: 'John' }])
    },
  })

const omitted = functions
  .define({
    input: model.unknown(),
    output: model.unknown(),
  })
  .implement({
    async body() {
      return result.ok(1)
    },
  })

const m = module.build({
  name: 'test',
  functions: { ping, getUsers, divideBy, omitted },
})

export const api = buildApi({
  exclusions: {
    omitted: true,
  },
  module: m,
})
