import { ErrorHandler, FunctionSpecifications, Request, Response } from './api'
import { generateInputType, generateOpenapiInput, splitInputAndRetrieve } from './openapi'
import { result, types } from '@mondrian-framework/model'
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
  functionBody: functions.FunctionImplementation
  specification: FunctionSpecifications
  context: (serverContext: ServerContext) => Promise<ContextInput>
  globalMaxVersion: number
  error?: ErrorHandler<functions.Functions, ServerContext>
}): (args: { request: Request; serverContext: ServerContext }) => Promise<Response> {
  const minVersion = specification.version?.min ?? 1
  const maxVersion = specification.version?.max ?? globalMaxVersion
  const getInputFromRequest = specification.openapi
    ? specification.openapi.input
    : generateGetInputFromRequest({ functionBody, specification })
  const inputType = generateInputType(functionBody)
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
    const version = checkVersion({ request, minVersion, maxVersion })
    if (!version.isOk) {
      operationLogger.logError('Bad request. (version)')
      endSpanWithError({ span, failure: version })
      return addHeadersToResponse(version.error, responseHeaders)
    }

    //Decode input
    const rawInput = getInputFromRequest(request)
    const decoded = decodeRawInput({ rawInput, inputType })
    if (!decoded.isOk) {
      operationLogger.logError('Bad request. (input)')
      endSpanWithError({ span, failure: decoded })
      return addHeadersToResponse(decoded.error, responseHeaders)
    }
    span?.addEvent('Input decoded')

    //Split retrieve and input
    const { input, retrieve } = splitInputAndRetrieve(decoded.value, functionBody)

    let moduleContext
    try {
      const contextInput = await context(serverContext)
      moduleContext = await module.context(contextInput, {
        retrieve,
        input,
        operationId,
        logger: operationLogger,
      })
      const result = await functionBody.apply({
        retrieve: retrieve,
        input: input as never,
        context: moduleContext as Record<string, unknown>,
        operationId,
        logger: operationLogger,
      })
      if (result.isOk) {
        const encoded = partialOutputType.encodeWithoutValidation(result.value)
        const response: Response = { status: 200, body: encoded, headers: responseHeaders }
        operationLogger.logInfo('Completed.')
        endSpanWithResponse({ span, response })
        return response
      } else {
        const codes = (specification.errorCodes ?? {}) as Record<string, number>
        const key = Object.keys(result.error)[0]
        const status = codes[key] ?? 400
        const encoded = functionBody.error.encodeWithoutValidation(result.error)
        const response: Response = { status, body: encoded, headers: responseHeaders }
        operationLogger.logInfo('Completed with error.')
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
          functionArgs: { input, retrieve },
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
  if (tracer) {
    return async ({ request, serverContext }) => {
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
    }
  } else {
    return ({ request, serverContext }) => handler(request, serverContext)
  }
}

function generateGetInputFromRequest(args: {
  specification: FunctionSpecifications
  functionBody: functions.FunctionImplementation
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

function decodeRawInput({
  rawInput,
  inputType,
}: {
  rawInput: unknown
  inputType: types.Type
}): result.Result<unknown, Response> {
  const decoded = types.concretise(inputType).decode(rawInput, { typeCastingStrategy: 'tryCasting' })
  return decoded.mapError((error) => ({ status: 400, body: { errors: error }, headers: {} }))
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
  span?.setStatus({ code: response.status.toString().slice(0, 1) === '2' ? SpanStatusCode.OK : SpanStatusCode.ERROR })
  span?.end()
}
