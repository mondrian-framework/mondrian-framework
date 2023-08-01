import { m } from '@mondrian-framework/model'
import { result } from '@mondrian-framework/model'

export type URLType = m.CustomType<'URL', {}, URL>

export function url(options?: m.BaseOptions): URLType {
  return m.custom(
    'URL',
    (value) => value.toString(),
    decodeUrl,
    (_url) => result.success(true),
    options,
  )
}

function decodeUrl(value: unknown): result.Result<URL> {
  return typeof value === 'string' || value instanceof URL
    ? makeUrl(value)
    : result.error('Invalid URL format (RFC 3986)', value)
}

function makeUrl(value: string | URL): result.Result<URL> {
  try {
    return result.success(new URL(value))
  } catch (_) {
    return result.error('Invalid URL format (RFC 3986)', value)
  }
}
