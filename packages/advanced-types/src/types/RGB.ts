import { fromRegexes } from './builder'
import { m } from '@mondrian-framework/model'

const RGB_REGEX =
  /^rgb\(\s*(-?\d+|-?\d*\.\d+(?=%))(%?)\s*,\s*(-?\d+|-?\d*\.\d+(?=%))(\2)\s*,\s*(-?\d+|-?\d*\.\d+(?=%))(\2)\s*\)$/

export type RGBType = m.CustomType<'RGB', {}, string>

export function rgb(options?: m.BaseOptions): RGBType {
  return fromRegexes('RGB', 'Invalid CSS RGB color', options, RGB_REGEX)
}
