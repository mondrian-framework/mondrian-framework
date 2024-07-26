import { decoding, model, validation } from '../..'
import gen from 'fast-check'

export type URLType = model.CustomType<'URL', { allowedProtocols?: string[] }, string>

export function url(options?: model.BaseOptions & { allowedProtocols?: string[] }): URLType {
  return model.custom({ typeName: 'URL', encoder, decoder, validator, arbitrary, options })
}

function encoder(url: string): string {
  return url
}

function decoder(value: unknown): decoding.Result<string> {
  if (value instanceof URL) {
    return decoding.succeed(value.href)
  }
  if (typeof value === 'string') {
    return decoding.succeed(value)
  }
  return decoding.fail('url', value)
}

function validator(value: string, _: validation.Options, options?: { allowedProtocols?: string[] }): validation.Result {
  try {
    const url = new URL(value)
    const protocol = url.protocol.slice(0, -1)
    if (options?.allowedProtocols && !options.allowedProtocols.includes(protocol)) {
      return validation.fail(`Invalid protocol, expected one of ${options.allowedProtocols.join(', ')}`, value)
    }
    return validation.succeed()
  } catch {
    return validation.fail('Invalid URL format (RFC 3986)', value)
  }
}

function arbitrary(): gen.Arbitrary<string> {
  return gen.webUrl()
}
