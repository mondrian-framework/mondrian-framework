import { Types } from '@mondrian/model'
import { Functions, Module } from '@mondrian/module'
import { FastifyInstance, FastifyRequest } from 'fastify'
import { fastifyStatic } from '@fastify/static'
import { getAbsoluteFSPath } from 'swagger-ui-dist'
import path from 'path'
import fs from 'fs'
import { attachRestMethods, openapiSpecification } from './openapi'

export type RestFunctionSpecs = { method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'; path?: string }
export type ModuleRestApi<F extends Functions> = {
  functions: {
    [K in keyof F]?: RestFunctionSpecs | readonly RestFunctionSpecs[]
  }
  options?: {
    introspection?: boolean
    /**
     * Default is /api
     */
    pathPrefix?: string
  }
}

export function serve<const T extends Types, const F extends Functions<keyof T extends string ? keyof T : string>, CI>({
  module,
  api,
  server,
  context,
}: {
  module: Module<T, F, CI>
  api: ModuleRestApi<F>
  server: FastifyInstance
  context: (args: { request: FastifyRequest }) => Promise<CI>
}): void {
  const pathPrefix = api.options?.pathPrefix ?? `/${module.name.toLocaleLowerCase()}/api`
  if (api.options?.introspection) {
    server.register(fastifyStatic, {
      root: getAbsoluteFSPath(),
      prefix: `${pathPrefix}/doc`,
    })
    const indexContent = fs
      .readFileSync(path.join(getAbsoluteFSPath(), 'swagger-initializer.js'))
      .toString()
      .replace('https://petstore.swagger.io/v2/swagger.json', `${pathPrefix}/doc/schema.json`)
    server.get(`${pathPrefix}/doc/swagger-initializer.js`, (req, res) => res.send(indexContent))
    server.get(`${pathPrefix}/doc`, (req, res) => {
      res.redirect(`${pathPrefix}/doc/index.html`)
    })
    const spec = openapiSpecification({ module, api, pathPrefix })
    server.get(`${pathPrefix}/doc/schema.json`, () => spec)
  }
  attachRestMethods({ module, api, server, context, pathPrefix })
}
