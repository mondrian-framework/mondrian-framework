import { fromRegexes } from './builder'
import { m } from '@mondrian-framework/model'

const RGBA_REGEX =
  /^rgba\(\s*(-?\d+|-?\d*\.\d+(?=%))(%?)\s*,\s*(-?\d+|-?\d*\.\d+(?=%))(\2)\s*,\s*(-?\d+|-?\d*\.\d+(?=%))(\2)\s*,\s*(-?\d+|-?\d*.\d+)\s*\)$/

export type RGBAType = m.CustomType<'RGBA', {}, string>

export function rgba(options?: m.BaseOptions): RGBAType {
  return fromRegexes('RGBA', 'Invalid CSS RGBA color', options, RGBA_REGEX)
}
