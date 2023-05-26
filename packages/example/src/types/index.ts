import t from '@mondrian-framework/model'
import * as scalars from './scalars.types'
import * as users from './user.types'
export * from './user.types'
export * from './scalars.types'

export const types = t.types({
  ...scalars,
  ...users,
  Void: t.void(),
})
export type Types = typeof types
