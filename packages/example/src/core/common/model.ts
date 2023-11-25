import { model } from '@mondrian-framework/model'

export type IdType = model.Infer<typeof idType>
export const idType = model.string({
  name: 'Id',
  description: 'an id that uniquely identifies an entity',
  regex: /^[0-9a-f]{24}$/,
})
