import { ModuleRestApi } from '@mondrian/rest'
import { Functions } from './functions'
import { ModuleGraphqlApi } from '@mondrian/graphql'
import { module } from './module'

//TODO: 
//How to exlude function implementation in package release?
//create a genetaror that writes a sdk.ts with only the required information
export const MODULE = module

export const REST_API = {
  functions: {
    register: { method: 'POST', path: '/subscribe' },
    //user: { method: 'GET' },
    users: { method: 'GET' },
  },
  options: { introspection: true },
} as const satisfies ModuleRestApi<Functions>

export const GRAPHQL_API = {
  functions: {
    register: { type: 'mutation', name: 'subscribe', inputName: "user" },
    user: { type: 'query' },
    //users: { type: 'query' },
  },
  options: { introspection: true },
} as const satisfies ModuleGraphqlApi<Functions>
