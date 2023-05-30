import { success } from '../result'
import { RootCustomType, literal } from '../type-system'

const VoidEncodeType = literal(null).optional()
type VoidEncodeType = typeof VoidEncodeType
export type VoidType = RootCustomType<void, VoidEncodeType, {}>
export function voidType(opts?: VoidType['opts']): VoidType {
  return {
    kind: 'custom',
    name: 'void',
    type: undefined as void,
    encodedType: VoidEncodeType,
    decode: () => {
      return success<void>(undefined)
    },
    encode: () => {
      return undefined
    },
    validate() {
      return success<void>(undefined)
    },
    opts,
  }
}
