import { policies, posts, users } from '.'
import { module as moduleInterface } from '../interface'

//Instance of this module
export const module = moduleInterface.implement({
  functions: {
    ...posts,
    ...users,
  },
  options: {
    maxSelectionDepth: 4,
    checkOutputType: 'throw',
    opentelemetry: true,
  },
  policies(context) {
    if (context.auth != null) {
      return policies.loggedUser(context.auth.userId)
    } else {
      return policies.guest
    }
  },
})
