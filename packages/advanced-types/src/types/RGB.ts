import { fromRegexes } from './builder'
import { m } from '@mondrian-framework/model'

const RGB_REGEX =
  /^rgb\(\s*(-?\d+|-?\d*\.\d+(?=%))(%?)\s*,\s*(-?\d+|-?\d*\.\d+(?=%))(\2)\s*,\s*(-?\d+|-?\d*\.\d+(?=%))(\2)\s*\)$/

export function rgb(options?: m.BaseOptions): m.CustomType<'RGB', {}, string> {
  return fromRegexes('RGB', 'Invalid CSS RGB color', options, RGB_REGEX)
}
