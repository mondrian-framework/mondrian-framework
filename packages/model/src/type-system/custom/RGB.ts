import { model } from '../..'
import { fromRegexes } from './regex'
import gen from 'fast-check'

const RGB_REGEX =
  /^rgb\(\s*(-?\d+|-?\d*\.\d+(?=%))(%?)\s*,\s*(-?\d+|-?\d*\.\d+(?=%))(\2)\s*,\s*(-?\d+|-?\d*\.\d+(?=%))(\2)\s*\)$/

export type RGBType = model.CustomType<'RGB', {}, string>

export function rgb(options?: model.BaseOptions): RGBType {
  return fromRegexes(
    'RGB',
    'Invalid CSS RGB color',
    options,
    gen.array(gen.integer({ min: 0, max: 255 }), { minLength: 3, maxLength: 3 }).map((v) => `rgb(${v.join(',')})`),
    RGB_REGEX,
  )
}
