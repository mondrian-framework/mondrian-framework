import { RegExpType, regexp } from './regexp'

const JWT_REGEX = /^[a-zA-Z0-9\-_]+?\.[a-zA-Z0-9\-_]+?\.([a-zA-Z0-9\-_]+)?$/

export function JWT(opts?: RegExpType['opts']) {
  return regexp('JWT', JWT_REGEX, 'Invalid JWT', opts)
}
