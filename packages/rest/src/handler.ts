import { ErrorHandler, FunctionSpecifications, Request, Response } from './api'
import { generateOpenapiInput } from './openapi'
import { decoding, projection, result, types, validation } from '@mondrian-framework/model'
import { functions, logger, module, utils } from '@mondrian-framework/module'
import opentelemetry, { SpanKind, SpanStatusCode, Counter, Histogram, Tracer, Span } from '@opentelemetry/api'
import { SemanticAttributes } from '@opentelemetry/semantic-conventions'

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
}): (args: { request: Request; serverContext: ServerContext }) => Promise<Response> {
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

  const tracer = module.options?.opentelemetryInstrumentation
    ? opentelemetry.trace.getTracer(`${module.name}:${functionName}-tracer`)
    : undefined

  const handler = async (request: Request, serverContext: ServerContext, span?: Span) => {
    const operationId = utils.randomOperationId()
    span?.setAttribute('operationId', operationId)
    const log = thisLogger.build({ operationId })
    const responseHeaders = { 'operation-id': operationId }

    //Check version
    const version = checkVersion({ request, minVersion, maxVersion })
    if (!version.isOk) {
      await log('Invalid version.')
      span?.setAttribute(SemanticAttributes.HTTP_STATUS_CODE, version.error.status)
      span?.setStatus({ code: SpanStatusCode.ERROR, message: JSON.stringify(version.error.body) })
      span?.end()
      return addHeadersToResponse(version.error, responseHeaders)
    }

    //Decode input
    const input = specification.openapi ? specification.openapi.input(request) : inputExtractor(request)
    const decoded = types.concretise(functionBody.input).decode(input, { typeCastingStrategy: 'tryCasting' })
    if (!decoded.isOk) {
      await log('Bad request.')
      span?.setAttribute(SemanticAttributes.HTTP_STATUS_CODE, 400)
      span?.setStatus({ code: SpanStatusCode.ERROR, message: JSON.stringify(decoded.error) })
      span?.end()
      return { status: 400, body: { errors: decoded.error }, headers: responseHeaders }
    }
    span?.addEvent('Input decoded')

    //Decode projection
    const givenProjection = extractProjection({ request, outputType: functionBody.output })
    if (!givenProjection.isOk) {
      await log('Bad request. (projection)')
      span?.setAttribute(SemanticAttributes.HTTP_STATUS_CODE, givenProjection.error.status)
      span?.setStatus({ code: SpanStatusCode.ERROR, message: JSON.stringify(givenProjection.error.body) })
      span?.end()
      return addHeadersToResponse(givenProjection.error, responseHeaders)
    }
    span?.addEvent('Projection decoded')

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
        input: decoded.value as never,
        operationId,
        log,
      })
      const encoded = types.concretise(partialOutputType).encode(result)
      log('Completed.')
      span?.setAttribute(SemanticAttributes.HTTP_STATUS_CODE, 200)
      span?.end()
      return { status: 200, body: encoded, headers: responseHeaders }
    } catch (e) {
      span?.setAttribute(SemanticAttributes.HTTP_STATUS_CODE, 500)
      if (e instanceof Error) {
        span?.recordException(e)
      }
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
          span?.setAttribute(SemanticAttributes.HTTP_STATUS_CODE, result.status)
          span?.end()
          return { ...result, headers: { ...result.headers, ...responseHeaders } }
        }
      }
      span?.end()
      throw e
    }
  }

  return async ({ request, serverContext }) => {
    if (tracer) {
      return tracer.startActiveSpan(
        `rest:${functionName}`,
        {
          attributes: {
            [SemanticAttributes.HTTP_METHOD]: request.method,
            [SemanticAttributes.HTTP_ROUTE]: request.route,
            'http.request.header.projection': request.headers.projection,
          },
          kind: SpanKind.SERVER,
        },
        (span) => handler(request, serverContext, span),
      )
    } else {
      return handler(request, serverContext)
    }
  }
}

function getInputExtractor(args: {
  specification: FunctionSpecifications
  functionBody: functions.Function
}): (request: Request) => unknown {
  return generateOpenapiInput({ ...args, typeMap: {}, typeRef: new Map() }).input
}

function checkVersion({
  request,
  minVersion,
  maxVersion,
}: {
  request: Request
  minVersion: number
  maxVersion: number
}): result.Result<number, Response> {
  const v = (request.params as Record<string, string>).v
  const version = Number(v ? v.replace('v', '') : Number.NaN)
  if (Number.isNaN(version) || version < minVersion || version > maxVersion) {
    return result.fail({
      status: 404,
      body: { error: 'Invalid version', minVersion: `v${minVersion}`, maxVersion: `v${maxVersion}`, got: version },
      headers: {},
    })
  }
  return result.ok(version)
}

function extractProjection({
  request,
  outputType,
}: {
  request: Request
  outputType: types.Type
}): result.Result<projection.Projection, Response> {
  const projectionHeader = request.headers.projection
  const projectionObject = typeof projectionHeader === 'string' ? JSON.parse(projectionHeader) : null
  const givenProjection = projection.decode(outputType, projectionObject != null ? projectionObject : true, {
    typeCastingStrategy: 'tryCasting',
  }) as decoding.Result<projection.Projection>
  return givenProjection.mapError((error) => ({
    status: 400,
    body: { errors: error, message: "On 'projection' header" },
    headers: {},
  }))
}

function addHeadersToResponse(response: Response, headers: Response['headers']): Response {
  return { ...response, headers: { ...response.headers, ...headers } }
}
