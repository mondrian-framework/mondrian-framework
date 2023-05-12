import t from '@mondrian/model'

export const Id = t.custom({
  name: 'ID',
  decode(input) {
    if (typeof input !== 'string') {
      return { pass: false, errors: [{ value: input, error: 'ID expected' }] }
    }
    if (input.length === 0) {
      return { pass: false, errors: [{ value: input, error: 'Empty ID is not valid' }] }
    }
    return { pass: true, value: input }
  },
  encode(input) {
    return input
  },
  is(input) {
    return typeof input === 'string' && input.length > 0
  },
})
export type Id = t.Infer<typeof Id>

export const UserProfile = t.object({
  firstname: t.string(),
  lastname: t.string(),
})

export const UserCredentials = t.object({
  email: t.string({ format: 'email' }),
  password: t.string({ format: 'password', minLength: 5 }),
})
export type UserCredentials = t.Infer<typeof UserCredentials>

export const ProfessionalUser = () =>
  t.object({
    id: Id,
    type: t.literal('PROFESSIONAL'),
    profile: UserProfile,
    credentials: UserCredentials,
    registeredAt: t.timestamp(),
  })
export type ProfessionalUser = t.Infer<typeof ProfessionalUser>

export const CustomerUser = () =>
  t.object({
    id: Id,
    type: t.literal('CUSTOMER'),
    profile: UserProfile,
    credentials: UserCredentials,
    registeredAt: t.timestamp(),
  })
export type CustomerUser = t.Infer<typeof CustomerUser>

export const User = t.union(
  { ProfessionalUser, CustomerUser },
  {
    is: {
      ProfessionalUser: (value) => value.type === 'PROFESSIONAL',
      CustomerUser: (value) => value.type === 'CUSTOMER',
    },
    discriminant: 'type',
  },
)
export type User = t.Infer<typeof User>

export const UserInput = t.union({
  ProfessionalUser: t.object({
    credentials: UserCredentials,
    profile: UserProfile,
    type: t.literal(ProfessionalUser().type.type.value),
  }),
  CustomerUser: t.object({
    credentials: UserCredentials,
    profile: UserProfile,
    type: t.literal(CustomerUser().type.type.value),
  }),
})

export const UserFilter = t.object({
  id: t.optional(Id),
})

export const UserOutput = t.optional(User)

export const UserOutputs = t.array(User)

export const types = t.types({
  Id,
  ProfessionalUser,
  CustomerUser,
  User,
  UserInput,
  UserFilter,
  UserOutput,
  UserOutputs,
  UserCredentials,
  UserProfile,
  Void: t.nothing(),
})
export type Types = typeof types
