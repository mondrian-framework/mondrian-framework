import { Functions } from './functions'
import { module } from './module'
import { Types } from './types'
import { CronApi } from '@mondrian-framework/cron'
import { GraphqlApi } from '@mondrian-framework/graphql'
import { RestApi } from '@mondrian-framework/rest'

//TODO:
//How to exlude function implementation in package release?
//create a genetaror that writes a sdk.ts with only the required information
export const MODULE = module

export const REST_API = {
  version: 100,
  functions: {
    register: [
      { method: 'post', path: '/subscribe', version: { max: 1 } },
      { method: 'put', path: '/register', version: { min: 2 } },
    ],
    users: { method: 'get', version: { min: 2 } },
    login: { method: 'put', path: '/login' },
    publish: { method: 'post', version: { min: 2 } },
    myPosts: { method: 'get', path: '/posts' },
  },
  options: { introspection: true },
} as const satisfies RestApi<Functions>

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
} satisfies GraphqlApi<Functions>

export const CRON_API = {
  functions: {
    checkPost: {
      cron: '*/30 * * * * *',
      runAtStart: false,
    },
  },
} satisfies CronApi<Types, Functions>
