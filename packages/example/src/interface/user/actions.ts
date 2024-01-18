import { idType } from '../common/model'
import { User, MyUser } from './model'
import { model } from '@mondrian-framework/model'
import { functions, retrieve } from '@mondrian-framework/module'

const LoginInput = model.object(
  {
    email: model.email(),
    password: model.string().sensitive(),
  },
  { name: 'LoginInput' },
)
const LoginOutput = model.string({ name: 'LoginOutput' })
const loginErrorMap = {
  invalidLogin: model.string(),
  tooManyRequests: model.string(),
} as const

export const login = functions.define({
  input: LoginInput,
  output: LoginOutput,
  errors: loginErrorMap,
  options: { description: `Gets the jwt of a user. This operation is rate limited` },
})

export const register = functions.define({
  input: model.object(
    {
      password: model.string().sensitive(),
      email: model.email(),
      firstName: model.string(),
      lastName: model.string(),
    },
    {
      name: 'RegisterInput',
    },
  ),
  output: MyUser,
  errors: { emailAlreadyTaken: model.literal('Email already taken') },
  retrieve: { select: true },
  options: {
    namespace: 'user',
    description: 'Creates a new user.',
  },
})

export const follow = functions.define({
  input: model.object({ userId: idType }),
  output: User,
  errors: { unauthorized: model.string(), userNotExists: model.string() },
  retrieve: { select: true },
  options: {
    namespace: 'user',
    description: 'Adds a follower to your user. Available only for logged user.',
  },
})

export const getUsers = functions.define({
  output: model.array(User),
  errors: { unauthorized: model.string() },
  retrieve: retrieve.allCapabilities,
  options: {
    namespace: 'user',
    description: 'Gets some users.',
  },
})
