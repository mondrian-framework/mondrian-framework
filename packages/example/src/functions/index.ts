import m from '@mondrian/module'
import * as posts from './post.functions'
import * as users from './user.functions'
export * from './post.functions'
export * from './user.functions'

export const functions = m.functions({
  ...posts,
  ...users,
})
export type Functions = typeof functions
