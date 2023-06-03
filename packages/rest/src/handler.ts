import { ErrorHandler, RestFunctionSpecs, RestMethod } from './api'
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

export async function handleRestRequest<ServerContext, ContextInput>({
  request,
  functionName,
  module,
  specification,
  functionBody,
  serverContext,
  context,
  globalMaxVersion,
  error,
}: {
  request: {
    body: string
    params: Record<string, string | undefined>
    query: Record<string, string | undefined>
    headers: Record<string, string | string[] | undefined>
    method: RestMethod
  }
  functionName: string
  module: GenericModule
  functionBody: GenericFunction
  specification: RestFunctionSpecs
  serverContext: ServerContext
  context: (serverContext: ServerContext) => Promise<ContextInput>
  globalMaxVersion: number
  error?: ErrorHandler<Functions, ServerContext>
}): Promise<{ status: number; body: unknown; headers?: Record<string, string | string[]> }> {
  const minVersion = specification.version?.min ?? 1
  const maxVersion = specification.version?.max ?? globalMaxVersion
  const v = (request.params as Record<string, string>).v
  const version = Number(v ? v.replace('v', '') : Number.NaN)
  if (Number.isNaN(version) || version < minVersion || version > maxVersion) {
    return {
      status: 404,
      body: { error: 'Invalid version', minVersion: `v${minVersion}`, maxVersion: `v${maxVersion}` },
    }
  }

  const startDate = new Date()
  const operationId = randomOperationId()
  const log = buildLogger(module.name, operationId, specification.method.toUpperCase(), functionName, 'REST', startDate)
  const headers = { 'operation-id': operationId }
  const inputFrom = request.method === 'get' || request.method === 'delete' ? 'query' : 'body'
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
    return { status: 400, body: { errors: decoded.errors }, headers }
  }
  const projectionHeader = request.headers['projection']
  const projectionObject = typeof projectionHeader === 'string' ? JSON.parse(projectionHeader) : null
  const fieldType = () => getProjectionType(outputType)
  const projection =
    projectionObject != null ? decode(fieldType(), projectionObject, { cast: true, strict: true }) : undefined
  if (projection && !projection.success) {
    log('Bad request. (projection)')
    return { status: 400, body: { errors: projection.errors, message: "On 'projection' header" }, headers }
  }
  const requiredProction =
    projection != null ? getRequiredProjection(outputType, projection.value as GenericProjection) : undefined
  const finalProjection =
    projection != null && requiredProction != null
      ? mergeProjections(projection.value as GenericProjection, requiredProction)
      : projection != null
      ? projection.value
      : undefined
  const contextInput = await context(serverContext)
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
    return { status: 200, body: encoded, headers }
  } catch (e) {
    log('Failed with exception.')
    if (error) {
      const result = await error({
        error: e,
        log,
        functionName,
        operationId,
        context: moduleCtx,
        functionArgs: {
          projection: finalProjection,
          input: decoded.value,
        },
        ...serverContext,
      })
      if (result !== undefined) {
        return { ...result, headers: { ...result.headers, ...headers } }
      }
    }
    throw e
  }
}
