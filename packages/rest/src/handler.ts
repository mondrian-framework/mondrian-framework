import { ApiSpecification, ErrorHandler, FunctionSpecifications } from './api'
import { CustomTypeSpecifications, clearInternalData, emptyInternalData, generateOpenapiInput } from './openapi'
import { completeRetrieve } from './utils'
import { result, model } from '@mondrian-framework/model'
import { functions, logger, module, retrieve, utils } from '@mondrian-framework/module'
import { http } from '@mondrian-framework/utils'
import { SpanKind, SpanStatusCode, Span } from '@opentelemetry/api'
import { SemanticAttributes } from '@opentelemetry/semantic-conventions'

export function fromFunction<
  Fs extends functions.Functions,
  E extends functions.ErrorType,
  ServerContext,
  ContextInput,
>({
  functionName,
  module,
  specification,
  functionBody,
  context,
  error,
  api,
}: {
  functionName: string
  module: module.Module<Fs, E, ContextInput>
  functionBody: functions.FunctionImplementation
  specification: FunctionSpecifications
  context: (serverContext: ServerContext) => Promise<ContextInput>
  error?: ErrorHandler<functions.Functions, ServerContext>
  api: Pick<ApiSpecification<functions.FunctionsInterfaces, E>, 'errorCodes' | 'customTypeSchemas'>
}): http.Handler<ServerContext> {
  const getInputFromRequest = specification.openapi
    ? specification.openapi.input
    : generateGetInputFromRequest({ functionBody, specification, customTypeSchemas: api.customTypeSchemas })
  const retrieveType = retrieve.fromType(functionBody.output, functionBody.retrieve)
  const partialOutputType = model.concretise(model.partialDeep(functionBody.output))
  const thisLogger = logger.build({
    moduleName: module.name,
    operationName: functionName,
    operationType: specification.method.toUpperCase(),
    server: 'REST',
  })

  const handler = ({ request, serverContext }: { request: http.Request; serverContext: ServerContext }) =>
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

        const subHandler = async () => {
          //Decode input
          const inputResult = decodeInput(functionBody.input, request, getInputFromRequest, tracer)
          if (inputResult.isFailure) {
            span?.end()
            return inputResult.error
          }
          const input = inputResult.value

          //Decode retrieve
          const retrieveResult = decodeRetrieve(retrieveType, functionBody.output, request, tracer)
          if (retrieveResult.isFailure) {
            span?.end()
            return retrieveResult.error
          }
          const retrieveValue: retrieve.GenericRetrieve | undefined = retrieveResult.value

          function handleFailure(error: Record<string, unknown>) {
            const codes = { ...api.errorCodes, ...specification.errorCodes } as Record<string, number>
            const key = Object.keys(error)[0]
            const status = key ? codes[key] ?? 400 : 400
            const response: http.Response = {
              status,
              body: JSON.stringify(error),
              headers: { 'Content-Type': 'application/json' },
            }
            endSpanWithResponse({ span, response })
            return response
          }

          try {
            //context building
            const contextInput = await context(serverContext)
            const ctxResult = await module.context(contextInput, {
              retrieve: retrieveValue,
              input,
              tracer: functionBody.tracer,
              logger: thisLogger,
              functionName,
            })
            if (ctxResult.isFailure) {
              return handleFailure(ctxResult.error)
            }
            // Function call
            const applyResult = await functionBody.apply({
              retrieve: retrieveValue ?? {},
              input: input as never,
              context: ctxResult.value as Record<string, unknown>,
              tracer: functionBody.tracer,
              logger: thisLogger,
            })
            //Output processing
            if (applyResult.isFailure) {
              return handleFailure(applyResult.error)
            } else {
              const encoded = partialOutputType.encodeWithoutValidation(applyResult.value)
              const contentType = specification.contentType ?? 'application/json'
              const response: http.Response = {
                status: 200,
                body: contentType === 'application/json' ? JSON.stringify(encoded) : encoded,
                headers: { 'Content-Type': contentType },
              }
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
                logger: thisLogger,
                functionName,
                tracer: functionBody.tracer,
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
        return { ...response, headers: { ...response.headers } }
      },
    )
  return handler
}

function decodeInput(
  inputType: model.Type,
  request: http.Request,
  getInputFromRequest: (request: http.Request) => unknown,
  tracer: functions.Tracer,
): result.Result<unknown, http.Response> {
  return tracer.startActiveSpan('decode-input', (span) => {
    if (model.isLiteral(inputType, undefined)) {
      return result.ok(undefined)
    }
    let rawInput
    try {
      rawInput = getInputFromRequest(request)
    } catch {
      const failure = result.fail<http.Response>({ body: 'Error while extracting input from request', status: 500 })
      endSpanWithError({ span, failure })
      return failure
    }
    const decoded = model
      .concretise(inputType)
      .decode(rawInput, { typeCastingStrategy: 'tryCasting' })
      .mapError((errors) => ({
        status: 400,
        body: JSON.stringify({ errors, message: 'Invalid input' }),
        headers: { 'Content-Type': 'application/json' },
      }))
    if (decoded.isFailure) {
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
  request: http.Request,
  tracer: functions.Tracer,
): result.Result<retrieve.GenericRetrieve | undefined, http.Response> {
  if (retrieveType.isFailure) {
    return result.ok(undefined)
  }
  return tracer.startActiveSpan('decode-retrieve', (span) => {
    const rawRetrieve = request.headers['retrieve']
    if (rawRetrieve && typeof rawRetrieve === 'string') {
      let jsonRawRetrieve
      try {
        jsonRawRetrieve = JSON.parse(rawRetrieve)
      } catch {
        const failure = result.fail<http.Response>({ body: 'Invalid JSON on "retrieve" header', status: 500 })
        endSpanWithError({ span, failure })
        return failure
      }
      const decodedRetrieve = model
        .concretise(retrieveType.value)
        .decode(jsonRawRetrieve, { typeCastingStrategy: 'tryCasting' })
        .mapError((errors) => ({
          status: 400,
          body: JSON.stringify({ errors, message: 'Invalid retrieve' }),
          headers: { 'Content-Type': 'application/json' },
        }))
      if (decodedRetrieve.isFailure) {
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
  customTypeSchemas: CustomTypeSpecifications | undefined
}): (request: http.Request) => unknown {
  const internalData = emptyInternalData(args.customTypeSchemas)
  const result = generateOpenapiInput({ ...args, internalData }).input
  clearInternalData(internalData)
  return result
}

function endSpanWithError({ span, failure }: { span?: Span; failure: result.Failure<http.Response> }): void {
  span?.setAttribute(SemanticAttributes.HTTP_STATUS_CODE, failure.error.status)
  span?.setStatus({ code: SpanStatusCode.ERROR, message: JSON.stringify(failure.error.body) })
  span?.end()
}

function endSpanWithResponse({ span, response }: { span?: Span; response: http.Response }): void {
  span?.setAttribute(SemanticAttributes.HTTP_STATUS_CODE, response.status)
  const responseHasSuccessStatusCode = 200 <= response.status && response.status <= 299
  const spanStatusCode = responseHasSuccessStatusCode ? SpanStatusCode.OK : SpanStatusCode.ERROR
  span?.setStatus({ code: spanStatusCode })
  span?.end()
}
