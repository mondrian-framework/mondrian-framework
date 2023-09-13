import { posts, users } from '.'

export type Context = users.actions.Context & posts.actions.Context
