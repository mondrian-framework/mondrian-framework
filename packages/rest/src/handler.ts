import { ErrorHandler, RestFunctionSpecs, RestRequest } from './api'
import { getInputExtractor } from './openapi'
import { decoder, encoder, projection, types } from '@mondrian-framework/model'
import { functions, logger, module, utils } from '@mondrian-framework/module'

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
  module: module.Module
  functionBody: functions.Function
  specification: RestFunctionSpecs
  context: (serverContext: ServerContext) => Promise<ContextInput>
  globalMaxVersion: number
  error?: ErrorHandler<functions.Functions, ServerContext>
}): (args: {
  request: RestRequest
  serverContext: ServerContext
}) => Promise<{ status: number; body: unknown; headers?: Record<string, string | string[]> }> {
  const minVersion = specification.version?.min ?? 1
  const maxVersion = specification.version?.max ?? globalMaxVersion
  const inputExtractor = getInputExtractor({ functionBody, module, specification })

  return async ({ request, serverContext }) => {
    const operationId = utils.randomOperationId()
    const log = logger.build({
      moduleName: module.name,
      operationId,
      operationName: functionName,
      operationType: specification.method.toUpperCase(),
      server: 'REST',
    })
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
      ? decoder.decode(functionBody.input, input, { typeCastingStrategy: 'tryCasting' })
      : decoder.decode(functionBody.input, input, { typeCastingStrategy: 'tryCasting' }).lazyOr(() =>
          decoder.decode(functionBody.input, request.query[specification.inputName ?? 'input'], {
            typeCastingStrategy: 'tryCasting',
          }),
        )
    if (!decoded.isOk) {
      log('Bad request.')
      return { status: 400, body: { errors: decoded.error }, headers }
    }
    const givenProjection = projection.decode(functionBody.output, projectionObject != null ? projectionObject : true, {
      typeCastingStrategy: 'tryCasting',
    })
    if (!givenProjection.isOk) {
      log('Bad request. (projection)')
      return { status: 400, body: { errors: givenProjection.error, message: "On 'projection' header" }, headers }
    }
    const contextInput = await context(serverContext)
    const moduleContext = await module.context(contextInput, {
      projection: givenProjection.value as projection.Projection,
      input: decoded.value,
      operationId,
      log,
    })
    try {
      const result = await functions.apply(functionBody, {
        projection: givenProjection.value as projection.FromType<types.Type>,
        context: moduleContext,
        input: decoded.value,
        operationId,
        log,
      })
      const partialOutputType = types.partialDeep(functionBody.output)
      const encoded = encoder.encode(partialOutputType, result)
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
          context: moduleContext,
          functionArgs: {
            projection: givenProjection.value,
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
