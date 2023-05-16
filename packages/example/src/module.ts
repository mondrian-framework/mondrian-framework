import m, { ContextType } from '@mondrian/module'
import { types, Types } from './types'
import { functions, Functions } from './functions'

const db = new Map<string, any>()

export const module = m.module<Types, Functions, { token?: string }>({
  name: 'Jopla',
  types,
  functions,
  async context(input: { token?: string }) {
    return { db, startingId: 1 }
  },
})
