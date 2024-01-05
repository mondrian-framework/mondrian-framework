import { posts, users } from '.'
import { module } from '@mondrian-framework/module'

//Merging all functions under a object
export type Functions = typeof functions
export const functions = {
  ...users.actions,
  ...posts.actions,
}

//Instance of of this module interface
export const instance = module.define({
  name: process.env.MODULE_NAME ?? '???',
  functions,
})
