import { types } from '../../'

export type NeverType = types.CustomType<'never', {}, never>
export function never(): NeverType {
  return types.custom<'never', {}, never>(
    'never',
    () => {
      throw new Error('Tried encoding a never value')
    },
    () => {
      throw new Error('Tried decoding a never value')
    },
    () => {
      throw new Error('Tried validating a never value')
    },
  )
}
