import { model } from '../..'

export type NeverType = model.CustomType<'never', {}, never>
export function never(): NeverType {
  return model.custom<'never', {}, never>(
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
    () => {
      throw new Error('Tried generating a never value')
    },
  )
}
