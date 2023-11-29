import { ApiSpecification, ErrorHandler, FunctionSpecifications, Request, Response } from './api'
import { clearInternalData, emptyInternalData, generateOpenapiInput } from './openapi'
import { completeRetrieve } from './utils'
import { result, retrieve, model } from '@mondrian-framework/model'
import { functions, logger, module, utils } from '@mondrian-framework/module'
import { SpanKind, SpanStatusCode, Span } from '@opentelemetry/api'
import { SemanticAttributes } from '@opentelemetry/semantic-conventions'

export function fromFunction<Fs extends functions.Functions, ServerContext, ContextInput>({
  functionName,
  module,
  specification,
  functionBody,
  context,
  error,
  api,
}: {
  functionName: string
  module: module.Module<Fs, ContextInput>
  functionBody: functions.FunctionImplementation
  specification: FunctionSpecifications
  context: (serverContext: ServerContext) => Promise<ContextInput>
  error?: ErrorHandler<functions.Functions, ServerContext>
  api: Pick<ApiSpecification<functions.FunctionsInterfaces>, 'errorCodes'>
}): (args: { request: Request; serverContext: ServerContext }) => Promise<Response> {
  const getInputFromRequest = specification.openapi
    ? specification.openapi.input
    : generateGetInputFromRequest({ functionBody, specification })
  const retrieveType = retrieve.fromType(functionBody.output, functionBody.retrieve)
  const partialOutputType = model.concretise(model.partialDeep(functionBody.output))

  const thisLogger = logger.build({
    moduleName: module.name,
    operationName: functionName,
    operationType: specification.method.toUpperCase(),
    server: 'REST',
  })

  const handler = ({ request, serverContext }: { request: Request; serverContext: ServerContext }) =>
    functionBody.tracer.startActiveSpanWithOptions(
      `mondrian:rest-handler:${functionName}`,
      {
        attributes: {
          [SemanticAttributes.HTTP_METHOD]: request.method,
          [SemanticAttributes.HTTP_ROUTE]: request.route,
        },
        kind: SpanKind.SERVER,
      },
      async (span) => {
        //Setup logging
        const tracer = functionBody.tracer.withPrefix(`mondrian:rest-handler:${functionName}:`)
        const operationId = utils.randomOperationId()
        span?.setAttribute('operationId', operationId)
        const logger = thisLogger.updateContext({ operationId })

        const subHandler = async () => {
          //Decode input
          const inputResult = decodeInput(functionBody.input, request, getInputFromRequest, logger, tracer)
          if (!inputResult.isOk) {
            span?.end()
            return inputResult.error
          }
          const input = inputResult.value

          //Decode retrieve
          const retrieveResult = decodeRetrieve(retrieveType, functionBody.output, request, logger, tracer)
          if (!retrieveResult.isOk) {
            span?.end()
            return retrieveResult.error
          }
          const retrieveValue: retrieve.GenericRetrieve | undefined = retrieveResult.value

          let moduleContext
          try {
            //context building
            const contextInput = await context(serverContext)
            moduleContext = await module.context(contextInput, {
              retrieve: retrieveValue,
              input,
              operationId,
              logger,
              functionName,
            })

            // Function call
            const applyOutput = await functionBody.apply({
              retrieve: retrieveValue ?? {},
              input: input as never,
              context: moduleContext as Record<string, unknown>,
              operationId,
              logger,
            })

            //Output processing
            if (functionBody.errors && !applyOutput.isOk) {
              const codes = { ...api.errorCodes, ...specification.errorCodes } as Record<string, number>
              const key = Object.keys(applyOutput.error as Record<string, unknown>)[0]
              const status = key ? codes[key] ?? 400 : 400
              const encoded = model
                .concretise(functionBody.errors[key])
                .encodeWithoutValidation(applyOutput.error as never)
              const response: Response = { status, body: encoded }
              endSpanWithResponse({ span, response })
              return response
            } else {
              const value = functionBody.errors ? applyOutput.value : applyOutput //unwrap output
              const encoded = partialOutputType.encodeWithoutValidation(value as never)
              const response: Response = { status: 200, body: encoded }
              endSpanWithResponse({ span, response })
              return response
            }
          } catch (e) {
            span?.setAttribute(SemanticAttributes.HTTP_STATUS_CODE, 500)
            if (e instanceof Error) {
              span?.recordException(e)
            }
            if (error) {
              const result = await error({
                error: e,
                logger,
                functionName,
                operationId,
                context: moduleContext,
                functionArgs: { input, retrieve: retrieveValue },
                ...serverContext,
              })
              if (result !== undefined) {
                span?.setAttribute(SemanticAttributes.HTTP_STATUS_CODE, result.status)
                span?.end()
                return result
              }
            }
            span?.end()
            throw e
          }
        }

        const response = await subHandler()
        return { ...response, headers: { ...response.headers, operationId } }
      },
    )
  return handler
}

function decodeInput(
  inputType: model.Type,
  request: Request,
  getInputFromRequest: (request: Request) => unknown,
  logger: logger.MondrianLogger,
  tracer: functions.Tracer,
): result.Result<unknown, Response> {
  return tracer.startActiveSpan('decode-input', (span) => {
    if (model.isNever(inputType)) {
      return result.ok(undefined)
    }
    let rawInput
    try {
      rawInput = getInputFromRequest(request)
    } catch {
      const failure = result.fail<Response>({ body: 'Error while extracting input from request', status: 500 })
      endSpanWithError({ span, failure })
      return failure
    }
    const decoded = model
      .concretise(inputType)
      .decode(rawInput, { typeCastingStrategy: 'tryCasting' })
      .mapError((errors) => ({ status: 400, body: { errors, message: 'Invalid input' }, headers: {} }))
    if (!decoded.isOk) {
      endSpanWithError({ span, failure: decoded })
      return result.fail(decoded.error)
    } else {
      span?.end()
      return result.ok(decoded.value)
    }
  })
}

function decodeRetrieve(
  retrieveType: result.Result<model.Type, unknown>,
  outputType: model.Type,
  request: Request,
  logger: logger.MondrianLogger,
  tracer: functions.Tracer,
): result.Result<retrieve.GenericRetrieve | undefined, Response> {
  if (!retrieveType.isOk) {
    return result.ok(undefined)
  }
  return tracer.startActiveSpan('decode-retrieve', (span) => {
    const rawRetrieve = request.headers['retrieve']
    if (rawRetrieve && typeof rawRetrieve === 'string') {
      let jsonRawRetrieve
      try {
        jsonRawRetrieve = JSON.parse(rawRetrieve)
      } catch {
        const failure = result.fail<Response>({ body: 'Invalid JSON on "retrieve" header', status: 500 })
        endSpanWithError({ span, failure })
        return failure
      }
      const decodedRetrieve = model
        .concretise(retrieveType.value)
        .decode(jsonRawRetrieve, { typeCastingStrategy: 'tryCasting' })
        .mapError((errors) => ({ status: 400, body: { errors, message: 'Invalid retrieve' }, headers: {} }))
      if (!decodedRetrieve.isOk) {
        endSpanWithError({ span, failure: decodedRetrieve })
        return result.fail(decodedRetrieve.error)
      }
      return result.ok(completeRetrieve(decodedRetrieve.value as retrieve.GenericRetrieve, outputType))
    } else {
      return result.ok(completeRetrieve({}, outputType))
    }
  })
}

function generateGetInputFromRequest(args: {
  specification: FunctionSpecifications
  functionBody: functions.FunctionImplementation
}): (request: Request) => unknown {
  const internalData = emptyInternalData()
  const result = generateOpenapiInput({ ...args, internalData }).input
  clearInternalData(internalData)
  return result
}

function endSpanWithError({ span, failure }: { span?: Span; failure: result.Failure<Response> }): void {
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
