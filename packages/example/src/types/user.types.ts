import t from '@mondrian/model'
import { Id } from './scalars.types'

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
    referrerId: Id,
    referrer: t.hide(CustomerUser),
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
