import { users } from '.'

export type Context = users.actions.LoginContext & users.actions.RegisterContext
