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
    user: { method: 'GET' },
    users: { method: 'GET' },
  },
  options: { introspection: true },
} as const satisfies ModuleRestApi<Functions>

export const GRAPHQL_API = {
  functions: {
    register: [
      { type: 'mutation', name: 'subscribe', inputName: 'user' },
      { type: 'mutation', name: 'register', inputName: 'user' },
    ],
    user: { type: 'query' },
    users: { type: 'query' },
  },
  options: { introspection: true },
} satisfies ModuleGraphqlApi<Functions>

export const SQS_API = {
  functions: {
    register: {
      inputQueueUrl: process.env.REGISTER_SQS_URL ?? '',
      malformedMessagePolicy: 'delete',
    },
  },
  options: {
    config: {
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
      },
      region: 'eu-central-1',
    },
  },
} satisfies ModuleSqsApi<Functions>

export const CRON_API = {
  functions: {
    register: {
      cron: '* 0 * * * *',
      runAtStart: true,
      input: async () => ({
        type: 'PROFESSIONAL' as const,
        credentials: { email: 'asd@gmail.com', password: 'lollol' },
        profile: { firstname: 'Asd', lastname: 'Lol' },
      }),
    },
  },
} satisfies ModuleCronApi<Types, Functions>
