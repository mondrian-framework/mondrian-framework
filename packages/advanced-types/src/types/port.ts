import { decoder, m, validator } from '@mondrian-framework/model'

const MIN_PORT_NUMBER = 1
const MAX_PORT_NUMBER = 65535

export type PortType = m.CustomType<'port', {}, number>

export function port(options?: m.BaseOptions): PortType {
  return m.custom(
    'port',
    (number) => number,
    (value) =>
      typeof value === 'number' && Number.isInteger(value)
        ? decoder.succeed(value)
        : decoder.fail('Expected a TCP port number', value),
    validatePort,
    options,
  )
}

function validatePort(value: number): validator.Result {
  return value < MIN_PORT_NUMBER || value > MAX_PORT_NUMBER
    ? validator.fail(`Invalid TCP port number (must be between ${MIN_PORT_NUMBER} and ${MAX_PORT_NUMBER})`, value)
    : validator.succeed()
}
