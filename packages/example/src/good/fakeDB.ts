import { LoginUserContext, RegisterUserContext, User } from './user'

type Context = RegisterUserContext & LoginUserContext

export function newFakeInMemoryDB(): Context {
  const passwordIdByUsername = new Map<string, [string, string]>()
  const usersById = new Map<string, User>()
  let id = 1

  return {
    async addUser(email, password, firstName, lastName, metadata) {
      const userId = id++
      const newUser = { id: `${userId}`, email, password, firstName, lastName, metadata, posts: [] }
      // We're not trying to do anything sophisticated here, users just get overwritten if they
      // have the same email
      passwordIdByUsername.set(email, [password, `${userId}`])
      usersById.set(`${userId}`, newUser)
      return newUser
    },

    async findUser(email, password) {
      const result = passwordIdByUsername.get(email)
      return result?.[0] === password ? result[1] : undefined
    },

    async updateLoginTime(id, loginTime) {
      const user = usersById.get(id)
      if (user) {
        const updatedUser = { ...user, metadata: { ...user.metadata, lastLogin: loginTime } }
        usersById.set(id, updatedUser)
        return updatedUser
      } else {
        return undefined
      }
    },
  }
}
