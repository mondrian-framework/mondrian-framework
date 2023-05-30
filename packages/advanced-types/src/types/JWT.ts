import { RegExpOpts, regexp } from './regexp'

const JWT_REGEX = /^[a-zA-Z0-9\-_]+?\.[a-zA-Z0-9\-_]+?\.([a-zA-Z0-9\-_]+)?$/

export function JWT(opts?: RegExpOpts) {
  return regexp('JWT', JWT_REGEX, 'Invalid JWT', opts)
}
