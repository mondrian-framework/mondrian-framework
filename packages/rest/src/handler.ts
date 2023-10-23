import { ErrorHandler, FunctionSpecifications, Request, Response } from './api'
import { generateOpenapiInput } from './openapi'
import { completeProjection } from './utils'
import { projection, result, types } from '@mondrian-framework/model'
import { functions, logger, module, utils } from '@mondrian-framework/module'
import opentelemetry, { SpanKind, SpanStatusCode, Span } from '@opentelemetry/api'
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
  functionBody: functions.FunctionImplementation<types.Type, types.Type, functions.ErrorType, Record<string, unknown>>
  specification: FunctionSpecifications
  context: (serverContext: ServerContext) => Promise<ContextInput>
  globalMaxVersion: number
  error?: ErrorHandler<functions.Functions, ServerContext>
}): (args: { request: Request; serverContext: ServerContext }) => Promise<Response> {
  const minVersion = specification.version?.min ?? 1
  const maxVersion = specification.version?.max ?? globalMaxVersion
  const inputExtractor = getInputExtractor({ functionBody, specification })
  const partialOutputType = types.concretise(types.partialDeep(functionBody.output))

  const thisLogger = logger.build({
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
    const operationLogger = thisLogger.updateContext({ operationId })
    const responseHeaders = { 'operation-id': operationId }

    //Check version
    const version = checkVersion(request, minVersion, maxVersion)
    if (!version.isOk) {
      operationLogger.logError('Bad request. (version)')
      endSpanWithError({ span, failure: version })
      return addHeadersToResponse(version.error, responseHeaders)
    }
    span?.addEvent('Version checked')

    //Decode input
    const input = specification.openapi ? specification.openapi.input(request) : inputExtractor(request)
    const decoded = decodeInput(input, functionBody.input)
    if (!decoded.isOk) {
      operationLogger.logError('Bad request. (input)')
      endSpanWithError({ span, failure: decoded })
      return addHeadersToResponse(decoded.error, responseHeaders)
    }
    span?.addEvent('Input decoded')

    //Decode projection
    const decodedProjection = decodeProjection(request, functionBody.output)
    if (!decodedProjection.isOk) {
      operationLogger.logError('Bad request. (projection)')
      endSpanWithError({ span, failure: decodedProjection })
      return addHeadersToResponse(decodedProjection.error, responseHeaders)
    }
    span?.addEvent('Projection decoded')

    const givenProjection = completeProjection(decodedProjection.value, functionBody.output)
    let moduleContext
    try {
      const contextInput = await context(serverContext)
      moduleContext = await module.context(contextInput, {
        projection: givenProjection,
        input: decoded.value,
        operationId,
        logger: operationLogger,
      })
      const res = (await functionBody.apply({
        projection: givenProjection as never,
        context: moduleContext as Record<string, unknown>,
        input: decoded.value as never,
        operationId,
        logger: operationLogger,
      })) as any

      if (result.isResult(res) && !res.isOk) {
        const codes = (specification.errorCodes ?? {}) as Record<string, number>
        const key = res.error ? Object.keys(res.error)[0] : undefined
        const status = key ? codes[key] ?? 400 : 400
        if (functionBody.error) {
          const encoded = functionBody.error.encodeWithoutValidation(res.error as any)
          const response: Response = { status, body: encoded, headers: responseHeaders }
          operationLogger.logInfo('Completed with error.')
          endSpanWithResponse({ span, response })
          return response
        } else {
          const reason =
            "Function failed with an error but it explicitly stated it couldn't fail since its error field is undefined"
          const failure = result.fail({ status: 500, body: { reason } })
          endSpanWithError({ span, failure })
          return addHeadersToResponse(failure.error, responseHeaders)
        }
      } else {
        let value = result.isResult(res) && res.isOk ? res.value : res
        const encoded = partialOutputType.encodeWithoutValidation(value as never)
        const response: Response = { status: 200, body: encoded, headers: responseHeaders }
        operationLogger.logInfo('Completed.')
        endSpanWithResponse({ span, response })
        return response
      }
    } catch (e) {
      span?.setAttribute(SemanticAttributes.HTTP_STATUS_CODE, 500)
      if (e instanceof Error) {
        span?.recordException(e)
      }
      operationLogger.logError('Failed with exception.')
      if (error) {
        const result = await error({
          error: e,
          logger: operationLogger,
          functionName,
          operationId,
          context: moduleContext,
          functionArgs: {
            projection: decodedProjection.value,
            input: decoded.value,
          },
          ...serverContext,
        })
        if (result !== undefined) {
          span?.setAttribute(SemanticAttributes.HTTP_STATUS_CODE, result.status)
          span?.end()
          return addHeadersToResponse(result, responseHeaders)
        }
      }
      span?.end()
      throw e
    }
  }

  return async ({ request, serverContext }) => {
    if (tracer) {
      return tracer.startActiveSpan(
        `mondrian:rest-handler:${functionName}`,
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
  functionBody: functions.FunctionImplementation<types.Type, types.Type, functions.ErrorType, Record<string, unknown>>
}): (request: Request) => unknown {
  return generateOpenapiInput({ ...args, typeMap: {}, typeRef: new Map() }).input
}

function checkVersion(request: Request, minVersion: number, maxVersion: number): result.Result<number, Response> {
  const rawVersion = request.params.v ?? ''
  return parseVersion(rawVersion)
    .mapError(toHttpError(404, 'Not a version number'))
    .chain((v) => checkVersionBounds(v, minVersion, maxVersion).mapError(toHttpError(404, 'Invalid version')))
}

function checkVersionBounds(
  version: number,
  minVersion: number,
  maxVersion: number,
): result.Result<number, { minVersion: number; maxVersion: number }> {
  const isInBounds = minVersion <= version && version <= maxVersion
  return isInBounds ? result.ok(version) : result.fail({ minVersion, maxVersion })
}

function parseVersion(rawVersion: string): result.Result<number, string> {
  const isValidVersion = /^v?\d+$/.test(rawVersion)
  return isValidVersion ? result.ok(Number(rawVersion)) : result.fail(`invalid version: ${rawVersion}`)
}

function decodeInput(input: unknown, inputType: types.Type): result.Result<unknown, Response> {
  return types.concretise(inputType).decode(input, { typeCastingStrategy: 'tryCasting' }).mapError(toHttpError(400))
}

function decodeProjection(request: Request, outputType: types.Type): result.Result<projection.Projection, Response> {
  const rawProjection = request.headers.projection
  const projectionObject = typeof rawProjection === 'string' ? JSON.parse(rawProjection) : true
  return projection
    .decode(outputType, projectionObject, { typeCastingStrategy: 'tryCasting' })
    .mapError(toHttpError(400, "On 'projection' header"))
}

function toHttpError(
  status: number,
  message?: string,
  additionalBody: Record<string, string> = {},
): (errors: any) => Response {
  return (errors) => ({ body: { errors, message, ...additionalBody }, status, headers: {} })
}

function addHeadersToResponse(response: Response, headers: Response['headers']): Response {
  return { ...response, headers: { ...response.headers, ...headers } }
}

function endSpanWithError({ span, failure }: { span?: Span; failure: result.Failure<any, Response> }): void {
  span?.setAttribute(SemanticAttributes.HTTP_STATUS_CODE, failure.error.status)
  span?.setStatus({ code: SpanStatusCode.ERROR, message: JSON.stringify(failure.error.body) })
  span?.end()
}

function endSpanWithResponse({ span, response }: { span?: Span; response: Response }): void {
  span?.setAttribute(SemanticAttributes.HTTP_STATUS_CODE, response.status)
  const responseHasSuccessStatusCode = 200 <= response.status && response.status <= 299
  const spanStatusCode = responseHasSuccessStatusCode ? SpanStatusCode.OK : SpanStatusCode.ERROR
  span?.setStatus({ code: spanStatusCode })
  span?.end()
}
