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
    preferredDecodingOptions: {
      errorReportingStrategy: 'allErrors',
    },
  },
  policies(args) {
    if ('auth' in args && args.auth?.userId != null) {
      return policies.loggedUser(args.auth.userId)
    } else {
      return policies.guest
    }
  },
})
