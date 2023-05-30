import { RegExpOpts, regexp } from './regexp'

const RGBA_REGEX =
  /^rgba\(\s*(-?\d+|-?\d*\.\d+(?=%))(%?)\s*,\s*(-?\d+|-?\d*\.\d+(?=%))(\2)\s*,\s*(-?\d+|-?\d*\.\d+(?=%))(\2)\s*,\s*(-?\d+|-?\d*.\d+)\s*\)$/

export function RGBA(opts?: RegExpOpts) {
  return regexp('RGBA', RGBA_REGEX, 'Invalid CSS RGBA color', opts)
}
