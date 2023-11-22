import * as fs from 'node:fs'
import * as http from 'node:http'
import * as path from 'node:path'
import { Api, ErrorHandler, FunctionSpecifications, Response } from './api'
import { functions } from '@mondrian-framework/module'
import { fromModule } from './openapi'
import { getAbsoluteFSPath } from 'swagger-ui-dist'
import { result } from '@mondrian-framework/model'
import { fromFunction } from './handler'
import { isArray } from '@mondrian-framework/utils'

const MIME_TYPES: Record<string, string> = {
  default: 'application/octet-stream',
  html: 'text/html; charset=UTF-8',
  js: 'application/javascript',
  css: 'text/css',
  png: 'image/png',
  jpg: 'image/jpg',
  gif: 'image/gif',
  ico: 'image/x-icon',
  svg: 'image/svg+xml',
}

export type Context = { server: { request: http.IncomingMessage; response: http.ServerResponse } }

/**
 * This is a naive implementation that expose a Mondrian module through REST API without using external libraries.
 * The implementation uses only raw node:http.
 * It's recommended to avoid this implementation on production environments because it can have vulnerabilities.
 * The recommended version is on '@mondrian-frameword/rest-fastify'
 */
export function serve<const Fs extends functions.Functions, ContextInput>({
  api,
  context,
  error,
  maxBodySize,
}: {
  api: Api<Fs, ContextInput>
  context: (serverContext: Context) => Promise<ContextInput>
  error?: ErrorHandler<Fs, Context>
  maxBodySize?: number
}): http.Server {
  const pathPrefix = api.options?.pathPrefix ?? '/api'
  const introspectionPath = api.options?.introspection
    ? typeof api.options.introspection === 'object'
      ? api.options.introspection.path
      : `/openapi`
    : null

  const openapiCache: Map<number, unknown> = new Map()
  const server = http.createServer({}, async (request, response) => {
    const { headers, method, url: rawUrl } = request
    const [url, urlQueryPart] = rawUrl!.split('?') 
    const query = Object.fromEntries(urlQueryPart?.split('&').map((v) => v.split('=')) ?? [])
    const pieces: Uint8Array[] = []
    const maximumBodySize = maxBodySize ?? 5 * 1024 * 1024 //5mb
    let totalLength = 0
    let closed = false
    request
      .on('data', (chunk: Uint8Array) => {
        if (totalLength <= maximumBodySize) {
          pieces.push(chunk)
          totalLength += chunk.length
          if (totalLength > maximumBodySize) {
            response.writeHead(413)
            response.end()
            response.socket?.end()
            closed = true
          }
        }
      })
      .on('end', () => {
        if (closed) {
          return
        }
        if (url?.startsWith(pathPrefix)) {
          const body = parseJSON(Buffer.concat(pieces))
          if (!body.isOk) {
            response.writeHead(400)
            response.write(body.error)
            response.end()
            return
          }
          const path = url.replace(pathPrefix, '')
          const lMethod = method?.toLocaleLowerCase()
          for (const [functionName, specification] of Object.entries(api.functions)) {
            const specifications = (
              isArray(specification) ? specification : [specification]
            ) as FunctionSpecifications[]
            for (const spec of specifications) {
              const paramsKey: string[] = []
              const pathRegex =
                '/v?[0-9]+' +
                (spec.path ?? `/${functionName}`).replaceAll(/{.*}/g, (s) => {
                  paramsKey.push(s.replace('}', '').replace('{', ''))
                  return '(.*)'
                })
              const match = new RegExp(`^${pathRegex}$`).exec(path)
              if (spec.method === lMethod && match) {
                const params = Object.fromEntries(paramsKey.map((k, i) => [k, match[i + 1]]))
                const handler = fromFunction({
                  api,
                  functionBody: api.module.functions[functionName],
                  functionName,
                  context,
                  module: api.module,
                  specification: spec,
                  error,
                })
                handler({
                  request: { body: body.value, headers, method: lMethod, params, query, route: url },
                  serverContext: { server: { request, response } },
                })
                  .then(({ body, status, headers }: Response) => {
                    response.writeHead(status, { ...headers, 'Content-Type': 'application/json' })
                    response.write(JSON.stringify(body))
                    response.end()
                  })
                  .catch((error: unknown) => {
                    response.writeHead(500)
                    if (error instanceof Error) {
                      response.write(error.message)
                    }
                    response.end()
                  })
                return
              }
            }
          }
          response.writeHead(404)
          response.end()
          return
        }
        if (introspectionPath != null && url?.startsWith(introspectionPath) && method === 'GET') {
          const schemaRegex = new RegExp(`^${introspectionPath}/v?([1-9]+)/schema\.json$`)
          const schemaMatch = schemaRegex.exec(url)
          if (schemaMatch) {
            const version = Number(schemaMatch[1])
            if (Number.isNaN(version) || !Number.isInteger(version) || version < 1 || version > api.version) {
              response.writeHead(404, { 'Content-Type': 'application/json' })
              response.write(
                JSON.stringify({ error: 'Invalid version', minVersion: `v1`, maxVersion: `v${api.version}` }),
              )
              response.end()
              return
            }
            const schema = openapiCache.get(version) ?? fromModule({ api, version, module: api.module })
            openapiCache.set(version, schema)
            response.writeHead(200, { 'Content-Type': 'application/json' })
            response.write(JSON.stringify(schema))
            response.end()
            return
          }
          if (url === `${introspectionPath}/swagger-initializer.js`) {
            const indexContent = fs
              .readFileSync(path.join(getAbsoluteFSPath(), 'swagger-initializer.js'))
              .toString()
              .replace(
                'https://petstore.swagger.io/v2/swagger.json',
                `${introspectionPath}/v${api.version}/schema.json`,
              )
            response.writeHead(200, { 'Content-Type': MIME_TYPES.js })
            response.write(indexContent)
            response.end()
            return
          }
          if (url === introspectionPath || url === `${introspectionPath}/`) {
            response.writeHead(308, { 'Content-Type': MIME_TYPES.html })
            response.write(`<head><meta http-equiv="Refresh" content="0; URL=${introspectionPath}/index.html"/></head>`)
            response.end()
            return
          }
          const requestedFile = url.replace(introspectionPath, '')
          const filePath = path.join(getAbsoluteFSPath(), requestedFile)
          fs.readFile(filePath, (err, data) => {
            if (err) {
              response.writeHead(404)
              response.end()
            } else {
              const splitted = requestedFile.split('.')
              const fileType = splitted[splitted.length - 1]
              response.writeHead(200, { 'Content-Type': MIME_TYPES[fileType] })
              response.write(data)
              response.end()
            }
          })
          return
        }
        response.writeHead(404)
        response.end()
      })
  })
  return server
}

function parseJSON(buffer: Buffer): result.Result<unknown, string> {
  try {
    return result.ok(JSON.parse(buffer.toString()))
  } catch (error) {
    return result.fail((error as Error).message)
  }
}
