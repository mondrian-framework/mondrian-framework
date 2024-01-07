import { decoding, model, validation } from '../..'

export type NeverType = model.CustomType<'never', {}, never>
export function never(): NeverType {
  return model.custom<'never', {}, never>({
    typeName: 'never',
    encoder: () => {
      throw new Error('Tried encoding a never value')
    },
    decoder: (value) => {
      return decoding.fail('never', value)
    },
    validator: (value) => {
      return validation.fail('Tried validating a never value', value)
    },
    arbitrary: () => {
      throw new Error('Tried generating a never value')
    },
  })
}
