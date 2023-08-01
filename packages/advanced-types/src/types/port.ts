import { m } from '@mondrian-framework/model'
import { result } from '@mondrian-framework/model'

const MIN_PORT_NUMBER = 1
const MAX_PORT_NUMBER = 65535

export type PortType = m.CustomType<'port', {}, number>

export function port(options?: m.BaseOptions): PortType {
  return m.custom(
    'port',
    (number) => number,
    (value) =>
      typeof value === 'number' && Number.isInteger(value)
        ? result.success(value)
        : result.error('Expected a TCP port number', value),
    validatePort,
    options,
  )
}

function validatePort(value: number): result.Result<true> {
  return value < MIN_PORT_NUMBER || value > MAX_PORT_NUMBER
    ? result.error(`Invalid TCP port number (must be between ${MIN_PORT_NUMBER} and ${MAX_PORT_NUMBER})`, value)
    : result.success(true)
}
