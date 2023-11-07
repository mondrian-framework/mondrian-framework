import { types } from '..'
import { fromRegexes } from './regex'

const VERSION_REGEX =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/

export type VersionType = types.CustomType<'version', {}, string>

export function version(options?: types.BaseOptions): VersionType {
  return fromRegexes('version', 'Invalid semantic version', options, undefined, VERSION_REGEX)
}
