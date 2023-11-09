import { ErrorHandler, FunctionSpecifications, Request, Response } from './api'
import { generateOpenapiInput } from './openapi'
import { completeRetrieve } from './utils'
import { result, retrieve, model } from '@mondrian-framework/model'
import { functions, logger, module, utils } from '@mondrian-framework/module'
import opentelemetry, { SpanKind, SpanStatusCode, Span } from '@opentelemetry/api'
import { SemanticAttributes } from '@opentelemetry/semantic-conventions'

export function fromFunction<Fs extends functions.Functions, ServerContext, ContextInput>({
  functionName,
  module,
  specification,
  functionBody,
  context,
  error,
}: {
  functionName: string
  module: module.Module<Fs, ContextInput>
  functionBody: functions.FunctionImplementation
  specification: FunctionSpecifications
  context: (serverContext: ServerContext) => Promise<ContextInput>
  error?: ErrorHandler<functions.Functions, ServerContext>
}): (args: { request: Request; serverContext: ServerContext }) => Promise<Response> {
  const getInputFromRequest = specification.openapi
    ? specification.openapi.input
    : generateGetInputFromRequest({ functionBody, specification })
  const inputType = functionBody.input
  const retrieveType = retrieve.fromType(functionBody.output, functionBody.retrieve)
  const partialOutputType = model.concretise(model.partialDeep(functionBody.output))

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

    //Decode input
    let input: unknown = null
    if (!model.isNever(inputType)) {
      const rawInput = getInputFromRequest(request)
      const decoded = decodeRawInput({ input: rawInput, type: inputType })
      if (!decoded.isOk) {
        operationLogger.logError('Bad request. (input)')
        endSpanWithError({ span, failure: decoded })
        return addHeadersToResponse(decoded.error, responseHeaders)
      }
      input = decoded.value
      span?.addEvent('Input decoded')
    }

    //Decode retrieve
    let retrieveValue: retrieve.GenericRetrieve | undefined = undefined
    if (retrieveType.isOk) {
      const rawRetrieve = request.headers['retrieve']
      if (rawRetrieve && typeof rawRetrieve === 'string') {
        let jsonRawRetrieve
        try {
          jsonRawRetrieve = JSON.parse(rawRetrieve)
        } catch {
          jsonRawRetrieve = 'Invalid JSON'
        }
        const decodedRetrieve = decodeRawRetrieve({ input: jsonRawRetrieve, type: retrieveType.value })
        if (!decodedRetrieve.isOk) {
          operationLogger.logError('Bad request. (retrieve)')
          endSpanWithError({ span, failure: decodedRetrieve })
          return addHeadersToResponse(decodedRetrieve.error, responseHeaders)
        }
        retrieveValue = completeRetrieve(decodedRetrieve.value as retrieve.GenericRetrieve, functionBody.output)
      } else {
        retrieveValue = completeRetrieve({}, functionBody.output)
      }
      span?.addEvent('Retrieve decoded')
    }

    let moduleContext
    try {
      const contextInput = await context(serverContext)
      moduleContext = await module.context(contextInput, {
        retrieve: retrieveValue,
        input,
        operationId,
        logger: operationLogger,
      })
      const res = (await functionBody.apply({
        retrieve: retrieveValue ?? {},
        input: input as never,
        context: moduleContext as Record<string, unknown>,
        operationId,
        logger: operationLogger,
      })) as any

      if (result.isResult(res) && !res.isOk) {
        const codes = (specification.errorCodes ?? {}) as Record<string, number>
        if (functionBody.errors) {
          const key = Object.keys(res.error as Record<string, unknown>)[0]
          const status = key ? codes[key] ?? 400 : 400
          const encoded = model.concretise(functionBody.errors[key]).encodeWithoutValidation(res.error as never)
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
          functionArgs: { input, retrieve: retrieveValue },
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
            'http.request.header.retrieve': request.headers.retrieve,
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
  return generateOpenapiInput({ ...args, internalData: { typeMap: {}, typeRef: new Map() } }).input
}

function decodeRawInput({ input, type }: { input: unknown; type: model.Type }): result.Result<unknown, Response> {
  const decoded = model.concretise(type).decode(input, { typeCastingStrategy: 'tryCasting' })
  return decoded.mapError((error) => ({ status: 400, body: { errors: error, message: 'Invalid input' }, headers: {} }))
}

function decodeRawRetrieve({ input, type }: { input: unknown; type: model.Type }): result.Result<unknown, Response> {
  const decoded = model.concretise(type).decode(input, { typeCastingStrategy: 'tryCasting' })
  return decoded.mapError((error) => ({
    status: 400,
    body: { errors: error, message: 'Invalid retrieve' },
    headers: {},
  }))
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
