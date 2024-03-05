import { model } from '@mondrian-framework/model'
import { error } from '@mondrian-framework/module'

export type IdType = model.Infer<typeof idType>
export const idType = model.integer({
  minimum: 0,
  name: 'Id',
  description: 'an id that uniquely identifies an entity',
})

export const { authenticationFailed, emailAlreadyTaken, postNotFound, userNotExists, invalidLogin, tooManyRequests } =
  error.define(
    {
      authenticationFailed: {
        message: 'Authentication process has failed.',
        reason: model.enumeration(['InvalidJwt', 'AuthorizationMissing']),
      },
      postNotFound: { message: 'Post not found.' },
      emailAlreadyTaken: { message: 'Email already taken.' },
      userNotExists: { message: 'User does not exists.' },
      invalidLogin: { message: 'Invalid email or passowrd.' },
      tooManyRequests: {
        message: 'Too many request',
        limitedBy: model.enumeration(['ip', 'email']),
      },
    },
    { capitalizeErrorNames: true },
  )
