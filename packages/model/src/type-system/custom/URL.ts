import { decoding, model, validation } from '../..'
import gen from 'fast-check'

export type URLType = model.CustomType<'URL', {}, URL>

export function url(options?: model.BaseOptions): URLType {
  return model.custom({ typeName: 'URL', encoder, decoder, validator, arbitrary, options })
}

function encoder(url: URL): string {
  return url.toString()
}

function decoder(value: unknown): decoding.Result<URL> {
  if (typeof value === 'string' || value instanceof URL) {
    try {
      return decoding.succeed(new URL(value))
    } catch {}
  }
  return decoding.fail('Invalid URL format (RFC 3986)', value)
}

function validator(): validation.Result {
  return validation.succeed()
}

function arbitrary(): gen.Arbitrary<URL> {
  return gen.webUrl().map((v) => new URL(v))
}
