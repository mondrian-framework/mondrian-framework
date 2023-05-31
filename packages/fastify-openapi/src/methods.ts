import { decodeQueryObject } from './utils'
import {
  GenericProjection,
  Result,
  decode,
  decodeAndValidate,
  encode,
  getProjectionType,
  getRequiredProjection,
  isVoidType,
  mergeProjections,
} from '@mondrian-framework/model'
import { Functions, GenericFunction, GenericModule, buildLogger, randomOperationId } from '@mondrian-framework/module'
import { ModuleRestApi, RestFunctionSpecs } from '@mondrian-framework/openapi'
import { isArray } from '@mondrian-framework/utils'
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

export function attachRestMethods({
  module,
  server,
  api,
  context,
  pathPrefix,
  globalMaxVersion,
}: {
  module: GenericModule
  server: FastifyInstance
  api: ModuleRestApi<Functions>
  context: (args: { request: FastifyRequest }) => Promise<unknown>
  pathPrefix: string
  globalMaxVersion: number
}): void {
  for (const [functionName, functionBody] of Object.entries(module.functions.definitions)) {
    const specifications = api.functions[functionName]
    if (!specifications) {
      continue
    }
    for (const specification of isArray(specifications) ? specifications : [specifications]) {
      const path = `${pathPrefix}/:v${specification.path ?? `/${functionName}`}`
      if (specification.method === 'GET') {
        server.get(path, (request, reply) =>
          elabFastifyRestRequest({
            request,
            reply,
            functionName,
            module,
            api,
            specification,
            functionBody,
            context,
            globalMaxVersion,
          }),
        )
      } else if (specification.method === 'POST') {
        server.post(path, (request, reply) =>
          elabFastifyRestRequest({
            request,
            reply,
            functionName,
            module,
            api,
            specification,
            functionBody,
            context,
            globalMaxVersion,
          }),
        )
      } else if (specification.method === 'PUT') {
        server.put(path, (request, reply) =>
          elabFastifyRestRequest({
            request,
            reply,
            functionName,
            module,
            api,
            specification,
            functionBody,
            context,
            globalMaxVersion,
          }),
        )
      } else if (specification.method === 'DELETE') {
        server.delete(path, (request, reply) =>
          elabFastifyRestRequest({
            request,
            reply,
            functionName,
            module,
            api,
            specification,
            functionBody,
            context,
            globalMaxVersion,
          }),
        )
      } else if (specification.method === 'PATCH') {
        server.patch(path, (request, reply) =>
          elabFastifyRestRequest({
            request,
            reply,
            functionName,
            module,
            api,
            specification,
            functionBody,
            context,
            globalMaxVersion,
          }),
        )
      }
    }
  }
}

function firstOf2<V>(f1: () => Result.Result<V>, f2: () => Result.Result<V>): Result.Result<V> {
  const v1 = f1()
  if (!v1.success) {
    const v2 = f2()
    if (v2.success) {
      return v2
    }
  }
  return v1
}

async function elabFastifyRestRequest({
  request,
  reply,
  functionName,
  module,
  specification,
  functionBody,
  context,
  globalMaxVersion,
  api,
}: {
  request: FastifyRequest
  reply: FastifyReply
  functionName: string
  module: GenericModule
  functionBody: GenericFunction
  api: ModuleRestApi<Functions>
  specification: RestFunctionSpecs
  context: (args: { request: FastifyRequest }) => Promise<unknown>
  globalMaxVersion: number
}): Promise<unknown> {
  const minVersion = specification.version?.min ?? 1
  const maxVersion = specification.version?.max ?? globalMaxVersion
  const v = (request.params as Record<string, string>).v
  const version = Number(v ? v.replace('v', '') : Number.NaN)
  if (Number.isNaN(version) || version < minVersion || version > maxVersion) {
    reply.status(404)
    return { error: 'Invalid version', minVersion: `v${minVersion}`, maxVersion: `v${maxVersion}` }
  }

  const startDate = new Date()
  const operationId = randomOperationId()
  const log = buildLogger(module.name, operationId, specification.method, functionName, 'REST', startDate)
  reply.header('operation-id', operationId)
  const inputFrom = request.method === 'GET' || request.method === 'DELETE' ? 'query' : 'body'
  const outputType = module.types[functionBody.output]
  const inputType = module.types[functionBody.input]
  const query = request.query as Record<string, unknown>
  const inputIsVoid = isVoidType(inputType)
  const input = inputIsVoid ? null : inputFrom === 'body' ? request.body : decodeQueryObject(query, 'input')
  const decoded = firstOf2(
    () => decodeAndValidate(inputType, input, { cast: true }),
    () => decodeAndValidate(inputType, query['input'], { cast: true }),
  )
  if (!decoded.success) {
    log('Bad request.')
    reply.status(400)
    return { errors: decoded.errors }
  }
  const projectionHeader = request.headers['projection']
  const projectionObject = typeof projectionHeader === 'string' ? JSON.parse(projectionHeader) : null
  const fieldType = () => getProjectionType(outputType)
  const projection =
    projectionObject != null ? decode(fieldType(), projectionObject, { cast: true, strict: true }) : undefined
  if (projection && !projection.success) {
    log('Bad request. (projection)')
    reply.status(400)
    return { errors: projection.errors, message: "On 'projection' header" }
  }
  const requiredProction =
    projection != null ? getRequiredProjection(outputType, projection.value as GenericProjection) : undefined
  const finalProjection =
    projection != null && requiredProction != null
      ? mergeProjections(projection.value as GenericProjection, requiredProction)
      : projection != null
      ? projection.value
      : undefined
  const contextInput = await context({ request })
  const ctx = await module.context(contextInput)
  try {
    const result = await functionBody.apply({
      projection: finalProjection,
      context: ctx,
      input: decoded.value,
      operationId,
      log,
    })
    const encoded = encode(outputType, result)
    log('Completed.')
    return encoded
  } catch (error) {
    log('Failed with exception.')
    if (api.errorHandler) {
      const result = await api.errorHandler({
        request,
        reply,
        error,
        log,
        functionName,
        operationId,
        context: ctx,
        functionArgs: {
          projection: finalProjection,
          input: decoded.value,
        },
      })
      if (result !== undefined) {
        return result
      }
    }
    throw error
  }
}
