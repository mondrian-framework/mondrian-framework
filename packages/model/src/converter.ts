import { DecodeOptions, DecodeResult, decode } from './decoder'
import { is } from './is'
import { Infer, LazyType } from './type-system'

export function convert<const T extends LazyType>(
  type: T,
  value: unknown,
  opts?: DecodeOptions,
): DecodeResult<Infer<T>> {
  const decoded = decode(type, value, opts)
  if (!decoded.success) {
    return decoded
  }
  const isCheck = is(type, decoded.value)
  if (!isCheck.success) {
    return isCheck
  }
  return decoded
}
