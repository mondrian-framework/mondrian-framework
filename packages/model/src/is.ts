import { JSONType } from '@mondrian-framework/utils'
import { LazyType } from './type-system'
import { lazyToType } from './utils'
import { decode } from './decoder'

export function is(type: LazyType, value: JSONType): boolean {
  const t = lazyToType(type)
  if (t.kind === 'custom') {
    return t.is(value, t.opts)
  }
  return decode(t, value).pass
}
