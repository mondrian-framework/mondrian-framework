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
  functions: {
    register: [
      { method: 'POST', path: '/subscribe' },
      { method: 'PUT', path: '/register' },
    ],
    users: { method: 'GET' },
    login: { method: 'PUT', path: '/login' },
    publish: { method: 'POST' },
  },
  options: { introspection: true },
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
  },
  options: { introspection: true },
} satisfies ModuleGraphqlApi<Functions>

export const CRON_API = {
  functions: {
    checkPost: {
      cron: '* 0 * * * *',
      runAtStart: false,
    },
  },
} satisfies ModuleCronApi<Types, Functions>
