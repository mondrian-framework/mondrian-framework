import { model } from '@mondrian-framework/model'

export type IdType = model.Infer<typeof idType>
export const idType = model.integer({
  minimum: 0,
  name: 'Id',
  description: 'an id that uniquely identifies an entity',
})
