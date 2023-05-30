import m from '@mondrian-framework/model'
import * as scalars from './scalars.types'
import * as users from './user.types'
export * from './user.types'
export * from './scalars.types'

export const types = m.types({
  ...scalars,
  ...users,
  Void: m.void(),
})
export type Types = typeof types
