import { ErrorHandler, RestFunctionSpecs, RestRequest } from './api'
import { getInputExtractor } from './openapi'
import {
  GenericProjection,
  Result,
  decode,
  decodeAndValidate,
  encode,
  getProjectedType,
  getProjectionType,
  getRequiredProjection,
  mergeProjections,
} from '@mondrian-framework/model'
import { Functions, GenericFunction, GenericModule, buildLogger, randomOperationId } from '@mondrian-framework/module'

export function generateRestRequestHandler<ServerContext, ContextInput>({
  functionName,
  module,
  specification,
  functionBody,
  context,
  globalMaxVersion,
  error,
}: {
  functionName: string
  module: GenericModule
  functionBody: GenericFunction
  specification: RestFunctionSpecs
  context: (serverContext: ServerContext) => Promise<ContextInput>
  globalMaxVersion: number
  error?: ErrorHandler<Functions, ServerContext>
}): (args: {
  request: RestRequest
  serverContext: ServerContext
}) => Promise<{ status: number; body: unknown; headers?: Record<string, string | string[]> }> {
  const minVersion = specification.version?.min ?? 1
  const maxVersion = specification.version?.max ?? globalMaxVersion
  const inputExtractor = getInputExtractor({ functionBody, module, specification })
  const projectionType = getProjectionType(functionBody.output)

  return async ({ request, serverContext }) => {
    const startDate = new Date()
    const operationId = randomOperationId()
    const log = buildLogger(
      module.name,
      operationId,
      specification.method.toUpperCase(),
      functionName,
      'REST',
      startDate,
    )
    const headers = { 'operation-id': operationId }
    const input = inputExtractor(request)
    const v = (request.params as Record<string, string>).v
    const version = Number(v ? v.replace('v', '') : Number.NaN)
    if (Number.isNaN(version) || version < minVersion || version > maxVersion) {
      return {
        status: 404,
        body: { error: 'Invalid version', minVersion: `v${minVersion}`, maxVersion: `v${maxVersion}` },
      }
    }
    const projectionHeader = request.headers['projection']
    const projectionObject = typeof projectionHeader === 'string' ? JSON.parse(projectionHeader) : null
    const decoded = specification.openapi
      ? decodeAndValidate(functionBody.input, input, { cast: true })
      : Result.firstOf2(
          () => decodeAndValidate(functionBody.input, input, { cast: true }),
          () =>
            decodeAndValidate(functionBody.input, request.query[specification.inputName ?? 'input'], { cast: true }),
        )
    if (!decoded.success) {
      log('Bad request.')
      return { status: 400, body: { errors: decoded.errors }, headers }
    }
    const projection =
      projectionObject != null ? decode(projectionType, projectionObject, { cast: true, strict: true }) : undefined
    if (projection && !projection.success) {
      log('Bad request. (projection)')
      return { status: 400, body: { errors: projection.errors, message: "On 'projection' header" }, headers }
    }
    const requiredProction =
      projection != null ? getRequiredProjection(functionBody.output, projection.value as GenericProjection) : undefined
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
      const projectedType = getProjectedType(functionBody.output, finalProjection as GenericProjection)
      const encoded = encode(projectedType, result)
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
}
