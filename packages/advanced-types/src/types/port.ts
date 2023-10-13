import { decoding, m, validation } from '@mondrian-framework/model'
import gen from 'fast-check'

const MIN_PORT_NUMBER = 1
const MAX_PORT_NUMBER = 65535

export type PortType = m.CustomType<'port', {}, number>

export function port(options?: m.BaseOptions): PortType {
  return m.custom(
    'port',
    (number) => number,
    (value) =>
      typeof value === 'number' && Number.isInteger(value)
        ? decoding.succeed(value)
        : decoding.fail('Expected a TCP port number', value),
    validatePort,
    () => gen.integer({ min: MIN_PORT_NUMBER, max: MAX_PORT_NUMBER }),
    options,
  )
}

function validatePort(value: number): validation.Result {
  return value < MIN_PORT_NUMBER || value > MAX_PORT_NUMBER
    ? validation.fail(`Invalid TCP port number (must be between ${MIN_PORT_NUMBER} and ${MAX_PORT_NUMBER})`, value)
    : validation.succeed()
}
