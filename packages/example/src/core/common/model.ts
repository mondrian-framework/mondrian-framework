import { types } from '@mondrian-framework/model'

export type IdType = types.Infer<typeof idType>
export const idType = types.string({
  name: 'Id',
  description: 'an id that uniquely identifies an entity',
  regex: /^[0-9a-f]{24}$/,
})

export type UnauthorizedType = types.Infer<typeof unauthorizedType>
export const unauthorizedType = types
  .union({
    notLoggedIn: types.literal('Invalid authentication'),
    unauthorized: types.object({}),
  })
  .setName('Unauthorized')
