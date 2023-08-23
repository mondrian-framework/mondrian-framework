import { ErrorHandler, FunctionSpecifications, Request } from './api'
import { generateOpenapiInput } from './openapi'
import { decoder, projection, types } from '@mondrian-framework/model'
import { functions, logger, module, utils } from '@mondrian-framework/module'

export function fromFunction<Fs extends functions.Functions, ServerContext, ContextInput>({
  functionName,
  module,
  specification,
  functionBody,
  context,
  globalMaxVersion,
  error,
}: {
  functionName: string
  module: module.Module<Fs, ContextInput>
  functionBody: functions.Function
  specification: FunctionSpecifications
  context: (serverContext: ServerContext) => Promise<ContextInput>
  globalMaxVersion: number
  error?: ErrorHandler<functions.Functions, ServerContext>
}): (args: {
  request: Request
  serverContext: ServerContext
}) => Promise<{ status: number; body: unknown; headers?: Record<string, string | string[]> }> {
  const minVersion = specification.version?.min ?? 1
  const maxVersion = specification.version?.max ?? globalMaxVersion
  const inputExtractor = getInputExtractor({ functionBody, specification })
  const partialOutputType = types.partialDeep(functionBody.output)

  const thisLogger = logger.withContext({
    moduleName: module.name,
    operationName: functionName,
    operationType: specification.method.toUpperCase(),
    server: 'REST',
  })

  return async ({ request, serverContext }) => {
    const operationId = utils.randomOperationId()
    const log = thisLogger.build({ operationId })
    const responseHeaders = { 'operation-id': operationId }
    const v = (request.params as Record<string, string>).v
    const version = Number(v ? v.replace('v', '') : Number.NaN)
    if (Number.isNaN(version) || version < minVersion || version > maxVersion) {
      log('Invalid version.')
      return {
        status: 404,
        body: { error: 'Invalid version', minVersion: `v${minVersion}`, maxVersion: `v${maxVersion}` },
        headers: responseHeaders,
      }
    }
    const input = specification.openapi ? specification.openapi.input(request) : inputExtractor(request)
    const decoded = decoder.decode(functionBody.input, input, { typeCastingStrategy: 'tryCasting' })
    if (!decoded.isOk) {
      log('Bad request.')
      return { status: 400, body: { errors: decoded.error }, headers: responseHeaders }
    }
    const projectionHeader = request.headers['projection']
    const projectionObject = typeof projectionHeader === 'string' ? JSON.parse(projectionHeader) : null
    const givenProjection = projection.decode(functionBody.output, projectionObject != null ? projectionObject : true, {
      typeCastingStrategy: 'tryCasting',
    })
    if (!givenProjection.isOk) {
      log('Bad request. (projection)')
      return {
        status: 400,
        body: { errors: givenProjection.error, message: "On 'projection' header" },
        headers: responseHeaders,
      }
    }
    let moduleContext
    try {
      const contextInput = await context(serverContext)
      moduleContext = await module.context(contextInput, {
        projection: givenProjection.value as projection.Projection,
        input: decoded.value,
        operationId,
        log,
      })
      const result = await functionBody.apply({
        projection: givenProjection.value as projection.FromType<types.Type>,
        context: moduleContext as Record<string, unknown>,
        input: decoded.value,
        operationId,
        log,
      })
      const encoded = types.concretise(partialOutputType).encode(result)
      log('Completed.')
      return { status: 200, body: encoded, headers: responseHeaders }
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
          return { ...result, headers: { ...result.headers, ...responseHeaders } }
        }
      }
      throw e
    }
  }
}

function getInputExtractor(args: {
  specification: FunctionSpecifications
  functionBody: functions.Function
}): (request: Request) => unknown {
  return generateOpenapiInput({ ...args, typeMap: {}, typeRef: new Map() }).input
}
