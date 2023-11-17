import { model } from '../..'
import { fromRegexes } from './regex'
import gen from 'fast-check'

const RGBA_REGEX =
  /^rgba\(\s*(-?\d+|-?\d*\.\d+(?=%))(%?)\s*,\s*(-?\d+|-?\d*\.\d+(?=%))(\2)\s*,\s*(-?\d+|-?\d*\.\d+(?=%))(\2)\s*,\s*(-?\d+|-?\d*.\d+)\s*\)$/

export type RGBAType = model.CustomType<'RGBA', {}, string>

export function rgba(options?: model.BaseOptions): RGBAType {
  return fromRegexes(
    'RGBA',
    'Invalid CSS RGBA color',
    options,
    gen.array(gen.integer({ min: 0, max: 255 }), { minLength: 4, maxLength: 4 }).map((v) => `rgba(${v.join(',')})`),
    RGBA_REGEX,
  )
}
