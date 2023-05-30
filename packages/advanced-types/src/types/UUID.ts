import { RegExpOpts, regexp } from './regexp'

const UUID_REGEX = /^(\{){0,1}[0-9a-fA-F]{8}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{12}(\}){0,1}$/

export function UUID(opts?: RegExpOpts) {
  return regexp('UUID', UUID_REGEX, 'Invalid Universally Unique Identifier', opts)
}
