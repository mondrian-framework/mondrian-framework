import * as scalars from './scalars.types'
import * as users from './user.types'
import m from '@mondrian-framework/model'

export * from './user.types'
export * from './scalars.types'

export const types = m.types({
  ...scalars,
  ...users,
  Void: m.void(),
})
export type Types = typeof types
