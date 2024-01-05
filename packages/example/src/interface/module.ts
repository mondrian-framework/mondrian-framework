import { posts, users } from '.'
import { module as m } from '@mondrian-framework/module'

//Instance of of this module interface
export const module = m.define({
  name: process.env.MODULE_NAME ?? '???',
  functions: {
    ...users.actions,
    ...posts.actions,
  },
})
