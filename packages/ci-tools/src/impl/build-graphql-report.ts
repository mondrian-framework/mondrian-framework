import { moduleInterface } from '../interface'
import { Context } from './module'

export const buildGraphQLReport = moduleInterface.functions.buildGraphQLReport.implement<Context>({
  async body({ input: { previousSchema, currentSchema, password }, context: { fileManager, serverBaseURL } }) {
    throw new Error('TODO')
  },
})
