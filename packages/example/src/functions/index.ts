import m from '@mondrian-framework/module'
import * as posts from './post.functions'
import * as users from './user.functions'
export * from './post.functions'
export * from './user.functions'

export const functions = m.functions({
  ...posts,
  ...users,
})
export type Functions = typeof functions
