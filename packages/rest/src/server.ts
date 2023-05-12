import { Types } from '@mondrian/model'
import { Functions, Module, ModuleRunnerOptions } from '@mondrian/module'
import { FastifyInstance } from 'fastify'
import { fastifyStatic } from '@fastify/static'
import { getAbsoluteFSPath } from 'swagger-ui-dist'
import path from 'path'
import fs from 'fs'
import { attachRestMethods, openapiSpecification } from './openapi'

export type RestFunctionSpecs = { method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'; path?: string }
export type ModuleRestApi<F extends Functions> = {
  functions: {
    [K in keyof F]: RestFunctionSpecs
  }
  options?: ModuleRunnerOptions
}

export async function exposeModuleAsREST<
  const T extends Types,
  const F extends Functions<keyof T extends string ? keyof T : string>,
>({ module, api, server }: { module: Module<T, F>; api: ModuleRestApi<F>; server: FastifyInstance }): Promise<void> {
  const httpPrefix = '/api'
  if (api.options?.introspection) {
    server.register(fastifyStatic, {
      root: getAbsoluteFSPath(),
      prefix: `${httpPrefix}/doc`,
    })
    const indexContent = fs
      .readFileSync(path.join(getAbsoluteFSPath(), 'swagger-initializer.js'))
      .toString()
      .replace('https://petstore.swagger.io/v2/swagger.json', `http://127.0.0.1:4000${httpPrefix}/doc/schema.json`)
    server.get(`${httpPrefix}/doc/swagger-initializer.js`, (req, res) => res.send(indexContent))
    server.get(`${httpPrefix}/doc`, (req, res) => {
      res.redirect(`${httpPrefix}/doc/index.html`)
    })
    const spec = openapiSpecification({ module, api })
    server.get(`${httpPrefix}/doc/schema.json`, () => spec)
  }
  attachRestMethods({ module, api, server })
}
