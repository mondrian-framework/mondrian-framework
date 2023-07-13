import { fromRegexes } from './builder'
import { m } from '@mondrian-framework/model'

const RGBA_REGEX =
  /^rgba\(\s*(-?\d+|-?\d*\.\d+(?=%))(%?)\s*,\s*(-?\d+|-?\d*\.\d+(?=%))(\2)\s*,\s*(-?\d+|-?\d*\.\d+(?=%))(\2)\s*,\s*(-?\d+|-?\d*.\d+)\s*\)$/

export function RGBA(options?: m.BaseOptions): m.CustomType<'RGBA', {}, string> {
  return fromRegexes('RGBA', 'Invalid CSS RGBA color', options, RGBA_REGEX)
}
