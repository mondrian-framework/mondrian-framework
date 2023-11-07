import { decoding, types, validation } from '..'
import gen from 'fast-check'

export type URLType = types.CustomType<'URL', {}, URL>

export function url(options?: types.BaseOptions): URLType {
  return types.custom(
    'URL',
    (value) => value.toString(),
    decodeUrl,
    (_url) => validation.succeed(),
    () => gen.webUrl().map((v) => new URL(v)),
    options,
  )
}

function decodeUrl(value: unknown): decoding.Result<URL> {
  return typeof value === 'string' || value instanceof URL
    ? makeUrl(value)
    : decoding.fail('Invalid URL format (RFC 3986)', value)
}

function makeUrl(value: string | URL): decoding.Result<URL> {
  try {
    return decoding.succeed(new URL(value))
  } catch (_) {
    return decoding.fail('Invalid URL format (RFC 3986)', value)
  }
}