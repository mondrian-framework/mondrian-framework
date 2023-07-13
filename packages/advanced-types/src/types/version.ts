import { fromRegexes } from './builder'
import { m } from '@mondrian-framework/model'

const VERSION_REGEX =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/

export function version(options?: m.BaseOptions): m.CustomType<'version', {}, string> {
  return fromRegexes('version', 'Invalid semantic version', options, VERSION_REGEX)
}
