import { m } from '@mondrian-framework/model'
import { Result, error, success } from '@mondrian-framework/model/src/result'

export function url(options?: m.BaseOptions): m.CustomType<'URL', {}, URL> {
  return m.custom(
    'URL',
    (value) => value.toString(),
    decodeUrl,
    (_url) => success(true),
    options,
  )
}

function decodeUrl(value: unknown): Result<URL> {
  return typeof value === 'string' || value instanceof URL
    ? makeUrl(value)
    : error('Invalid URL format (RFC 3986)', value)
}

function makeUrl(value: string | URL): Result<URL> {
  try {
    return success(new URL(value))
  } catch (_) {
    return error('Invalid URL format (RFC 3986)', value)
  }
}
