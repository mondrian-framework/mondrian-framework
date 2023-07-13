import { m } from '@mondrian-framework/model'
import { error, success, Result } from '@mondrian-framework/model/src/result'

const MIN_PORT_NUMBER = 1
const MAX_PORT_NUMBER = 65535

export function port(options?: m.BaseOptions): m.CustomType<'port', {}, number> {
  return m.custom(
    'port',
    (number) => number,
    (value) => (typeof value === 'number' ? success(value) : error('Expected a TCP port number', value)),
    validatePort,
    options,
  )
}

function validatePort(value: number): Result<number> {
  return value < MIN_PORT_NUMBER || value > MAX_PORT_NUMBER
    ? error(`Invalid TCP port number (must be between ${MIN_PORT_NUMBER + 1} and ${MAX_PORT_NUMBER})`, value)
    : success(value)
}
