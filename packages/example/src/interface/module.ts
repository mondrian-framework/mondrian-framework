import { posts, users } from '.'
import { model } from '@mondrian-framework/model'
import { module as m } from '@mondrian-framework/module'

//Instance of of this module interface
export const module = m.define({
  name: process.env.MODULE_NAME ?? '???',
  errors: { invalidJwt: model.string() },
  functions: {
    ...users.actions,
    ...posts.actions,
  },
})
