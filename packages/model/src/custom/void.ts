import { RootCustomType } from '../type-system'

export type VoidType = RootCustomType<void, {}>
export function voidType(opts?: VoidType['opts']): VoidType {
  return {
    kind: 'custom',
    name: 'void',
    decode: () => {
      return { success: true, value: undefined }
    },
    encode: () => {
      return undefined
    },
    is() {
      return { success: true }
    },
    opts,
    type: null as unknown as void,
  }
}
