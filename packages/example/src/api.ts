import { ModuleRestApi } from '@mondrian/rest'
import { Functions } from './functions'
import { ModuleGraphqlApi } from '@mondrian/graphql'
import { module } from './module'

//How to exlude function implementation in package release?
//create a genetaror that writes a sdk.ts with only the required information
export const MODULE = module

export const REST_API: ModuleRestApi<Functions> = {
  functions: {
    register: { method: 'POST' },
    user: { method: 'GET' },
    users: { method: 'GET' },
  },
  options: { introspection: true },
}

export const GRAPHQL_API: ModuleGraphqlApi<Functions> = {
  functions: {
    register: { type: 'mutation' },
    user: { type: 'query' },
    users: { type: 'query' },
  },
  options: { introspection: true },
}
