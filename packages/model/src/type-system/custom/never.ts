import { model } from '../..'

export type NeverType = model.CustomType<'never', {}, never>
export function never(): NeverType {
  return model.custom<'never', {}, never>({
    typeName: 'never',
    encoder: () => {
      throw new Error('Tried encoding a never value')
    },
    decoder: () => {
      throw new Error('Tried decoding a never value')
    },
    validator: () => {
      throw new Error('Tried validating a never value')
    },
    arbitrary: () => {
      throw new Error('Tried generating a never value')
    },
  })
}
