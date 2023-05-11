import { LazyType, Type } from './type-system'

export function lazyToType(t: LazyType): Type {
  if (typeof t === 'function') {
    return t()
  }
  return t
}
