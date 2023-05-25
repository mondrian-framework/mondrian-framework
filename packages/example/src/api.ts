import { ModuleRestApi } from '@mondrian/rest'
import { Functions } from './functions'
import { ModuleGraphqlApi } from '@mondrian/graphql'
import { module } from './module'
import { ModuleSqsApi } from '@mondrian/aws-sqs/src/listener'
import { ModuleCronApi } from '@mondrian/cron/src/executor'
import { Types } from './types'

//TODO:
//How to exlude function implementation in package release?
//create a genetaror that writes a sdk.ts with only the required information
export const MODULE = module

export const REST_API = {
  version: 100,
  functions: {
    register: [
      { method: 'POST', path: '/subscribe', version: { max: 1 } },
      { method: 'PUT', path: '/register', version: { min: 2 } },
    ],
    users: { method: 'GET', version: { min: 2 } },
    login: { method: 'PUT', path: '/login' },
    publish: { method: 'POST', version: { min: 2 } },
    myPosts: { method: 'GET', path: '/posts' },
  },
  options: { introspection: true },
  async errorHandler({ error, reply, log, functionName }) {
    if (error instanceof Error) {
      log(error.message)
      if (functionName === 'login') {
        reply.status(400)
        return 'Unauthorized'
      }
      reply.status(400)
      return 'Bad request'
    }
  },
} as const satisfies ModuleRestApi<Functions>

export const GRAPHQL_API = {
  functions: {
    register: [
      { type: 'mutation', name: 'subscribe', inputName: 'user' },
      { type: 'mutation', name: 'register', inputName: 'user' },
    ],
    users: { type: 'query' },
    login: { type: 'query' },
    publish: { type: 'mutation', inputName: 'post' },
    myPosts: { type: 'query', name: 'posts' },
  },
  options: { introspection: true },
} satisfies ModuleGraphqlApi<Functions>

export const CRON_API = {
  functions: {
    checkPost: {
      cron: '*/30 * * * * *',
      runAtStart: false,
    },
  },
} satisfies ModuleCronApi<Types, Functions>
