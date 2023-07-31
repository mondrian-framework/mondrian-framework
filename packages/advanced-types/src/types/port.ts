import { fc as gen } from '@fast-check/vitest'
import { m } from '@mondrian-framework/model'
import { error, success, Result } from '@mondrian-framework/model'

const MIN_PORT_NUMBER = 1
const MAX_PORT_NUMBER = 65535

export function port(options?: m.BaseOptions): m.CustomType<'port', {}, number> {
  return m.custom(
    'port',
    (number) => number,
    (value) =>
      typeof value === 'number' && Number.isInteger(value)
        ? success(value)
        : error('Expected a TCP port number', value),
    validatePort,
    gen.integer({ min: MIN_PORT_NUMBER, max: MAX_PORT_NUMBER }),
    options,
  )
}

function validatePort(value: number): Result<true> {
  return value < MIN_PORT_NUMBER || value > MAX_PORT_NUMBER
    ? error(`Invalid TCP port number (must be between ${MIN_PORT_NUMBER} and ${MAX_PORT_NUMBER})`, value)
    : success(true)
}
