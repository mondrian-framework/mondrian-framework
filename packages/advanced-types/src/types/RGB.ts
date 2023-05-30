import { RegExpOpts, regexp } from './regexp'

const RGB_REGEX =
  /^rgb\(\s*(-?\d+|-?\d*\.\d+(?=%))(%?)\s*,\s*(-?\d+|-?\d*\.\d+(?=%))(\2)\s*,\s*(-?\d+|-?\d*\.\d+(?=%))(\2)\s*\)$/

export function RGB(opts?: RegExpOpts) {
  return regexp('RGB', RGB_REGEX, 'Invalid CSS RGB color', opts)
}
