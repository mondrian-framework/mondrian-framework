import m from '@mondrian/module'
import { types } from './types'
import { functions } from './functions'

const db = new Map<string, any>()

export const module = m.module({
  name: 'Jopla',
  types,
  functions,
  async context({ functionName, headers }) {
    if (functionName === 'user') {
      throw new Error('Forbidden') //TODO: better error handling
    }
    return { startingId: 1, db }
  },
})
