import { RootCustomType } from '../type-system'

export type VoidType = RootCustomType<void, 'void', {}>
export function voidType(opts?: VoidType['opts']): VoidType {
  return {
    kind: 'custom',
    name: 'void',
    decode: (input) => {
      return { pass: true, value: input as void }
    },
    encode: (input) => {
      return undefined
    },
    is() {
      return true
    },
    opts,
    type: null as unknown as void,
  }
}
