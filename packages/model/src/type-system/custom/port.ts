import { decoding, model, validation } from '../..'
import gen from 'fast-check'

const MIN_PORT_NUMBER = 1
const MAX_PORT_NUMBER = 65535

export type PortType = model.CustomType<'port', {}, number>

export function port(options?: model.BaseOptions): PortType {
  return model.custom({ typeName: 'port', encoder, decoder, validator, arbitrary, options })
}

function encoder(value: number): number {
  return value
}

function decoder(value: unknown): decoding.Result<number> {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return decoding.succeed(value)
  } else {
    return decoding.fail('Expected a TCP port number', value)
  }
}

function validator(value: number): validation.Result {
  return value < MIN_PORT_NUMBER || value > MAX_PORT_NUMBER
    ? validation.fail(`Invalid TCP port number (must be between ${MIN_PORT_NUMBER} and ${MAX_PORT_NUMBER})`, value)
    : validation.succeed()
}

function arbitrary(): gen.Arbitrary<number> {
  return gen.integer({ min: MIN_PORT_NUMBER, max: MAX_PORT_NUMBER })
}
