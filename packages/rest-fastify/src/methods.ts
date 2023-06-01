import { ErrorHandler } from './server'
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
import { RestApi, RestFunctionSpecs } from '@mondrian-framework/rest'
import { isArray } from '@mondrian-framework/utils'
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

export function attachRestMethods({
  module,
  server,
  api,
  context,
  pathPrefix,
  globalMaxVersion,
  error,
}: {
  module: GenericModule
  server: FastifyInstance
  api: RestApi<Functions>
  context: (args: { fastify: { request: FastifyRequest; reply: FastifyReply } }) => Promise<unknown>
  pathPrefix: string
  globalMaxVersion: number
  error?: ErrorHandler<Functions>
}): void {
  for (const [functionName, functionBody] of Object.entries(module.functions.definitions)) {
    const specifications = api.functions[functionName]
    if (!specifications) {
      continue
    }
    for (const specification of isArray(specifications) ? specifications : [specifications]) {
      const path = `${pathPrefix}/:v${specification.path ?? `/${functionName}`}`
      server[specification.method](path, (request, reply) =>
        elabFastifyRestRequest({
          request,
          reply,
          functionName,
          module,
          specification,
          functionBody,
          context,
          globalMaxVersion,
          error,
        }),
      )
    }
  }
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
  error,
}: {
  request: FastifyRequest
  reply: FastifyReply
  functionName: string
  module: GenericModule
  functionBody: GenericFunction
  specification: RestFunctionSpecs
  context: (args: { fastify: { request: FastifyRequest; reply: FastifyReply } }) => Promise<unknown>
  globalMaxVersion: number
  error?: ErrorHandler<Functions>
}): Promise<unknown> {
  request.method
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
  const log = buildLogger(module.name, operationId, specification.method.toUpperCase(), functionName, 'REST', startDate)
  reply.header('operation-id', operationId)
  const inputFrom = request.method === 'GET' || request.method === 'DELETE' ? 'query' : 'body'
  const outputType = module.types[functionBody.output]
  const inputType = module.types[functionBody.input]
  const query = request.query as Record<string, unknown>
  const inputIsVoid = isVoidType(inputType)
  const input = inputIsVoid ? null : inputFrom === 'body' ? request.body : decodeQueryObject(query, 'input')
  const decoded = Result.firstOf2(
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
  const contextInput = await context({ fastify: { request, reply } })
  const moduleCtx = await module.context(contextInput)
  try {
    const result = await functionBody.apply({
      projection: finalProjection,
      context: moduleCtx,
      input: decoded.value,
      operationId,
      log,
    })
    const encoded = encode(outputType, result)
    log('Completed.')
    return encoded
  } catch (e) {
    log('Failed with exception.')
    if (error) {
      const result = await error({
        fastify: { request, reply },
        error: e,
        log,
        functionName,
        operationId,
        context: moduleCtx,
        functionArgs: {
          projection: finalProjection,
          input: decoded.value,
        },
      })
      if (result !== undefined) {
        return result
      }
    }
    throw e
  }
}
