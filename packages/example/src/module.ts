import m from '@mondrian/module'
import { types } from './types'
import { functions } from './operations'

const db = new Map<string, any>()

export const module = m.module({
  name: 'Jopla',
  types,
  functions,
  async context() {
    return { startingId: 1, db }
  },
})
