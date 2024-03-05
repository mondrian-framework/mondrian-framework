import { ApiSpecification, ErrorHandler, FunctionSpecifications } from './api'
import { CustomTypeSpecifications, clearInternalData, emptyInternalData, generateOpenapiInput } from './openapi'
import { completeRetrieve, methodFromOptions } from './utils'
import { result, model } from '@mondrian-framework/model'
import { exception, functions, logger, module, retrieve, utils } from '@mondrian-framework/module'
import { http, mapObject } from '@mondrian-framework/utils'
import { SpanKind, SpanStatusCode, Span } from '@opentelemetry/api'
import { SemanticAttributes } from '@opentelemetry/semantic-conventions'

export function fromFunction<Fs extends functions.FunctionImplementations, ServerContext>({
  functionName,
  module,
  specification,
  functionBody,
  context,
  onError,
  api,
}: {
  functionName: string
  module: module.Module<Fs>
  functionBody: functions.FunctionImplementation
  specification: FunctionSpecifications
  context: (serverContext: ServerContext) => Promise<module.FunctionsToContextInput<Fs>>
  onError?: ErrorHandler<functions.Functions, ServerContext>
  api: Pick<ApiSpecification<functions.FunctionInterfaces>, 'errorCodes' | 'customTypeSchemas'>
}): http.Handler<ServerContext> {
  const gatherRawInput = specification.openapi
    ? specification.openapi.input
    : generateGetInputFromRequest({ functionBody, specification, customTypeSchemas: api.customTypeSchemas })
  const partialOutputType = model.concretise(model.partialDeep(functionBody.output))
  const thisLogger = logger.build({
    moduleName: module.name,
    operationName: functionName,
    operationType: specification.method?.toLocaleLowerCase() ?? methodFromOptions(functionBody.options),
    server: 'REST',
  })
  const codes = { ...api.errorCodes, ...specification.errorCodes } as Record<string, number>

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
          try {
            //Decode input
            const rawInput = gatherRawInput(request)

            //Decode retrieve
            const rawRetrieveResult = gatherRawRetrieve(functionBody.output, request)
            if (rawRetrieveResult.isFailure) {
              span?.end()
              return rawRetrieveResult.error
            }
            const rawRetrieve = rawRetrieveResult.value

            //Context input retrieval
            const contextInput = await context(serverContext)

            // Function call
            const applyResult = await functionBody.rawApply({
              rawRetrieve,
              rawInput,
              contextInput: contextInput as Record<string, unknown>,
              tracer,
              logger: thisLogger,
              decodingOptions: { typeCastingStrategy: 'tryCasting' },
              mapper: { retrieve: (retrieve) => completeRetrieve(retrieve, functionBody.output) },
            })

            //Output processing
            if (applyResult.isFailure) {
              const key = Object.keys(applyResult.error)[0]
              const status = key ? codes[key] ?? 400 : 400
              const encodedError = mapObject(applyResult.error, (key, value) =>
                model.concretise((functionBody.errors ?? {})[key]).encodeWithoutValidation(value as never),
              )
              const response: http.Response = {
                status,
                body: encodedError,
                headers: { 'Content-Type': 'application/json' },
              }
              endSpanWithResponse({ span, response })
              return response
            } else {
              const encoded = partialOutputType.encodeWithoutValidation(applyResult.value)
              const contentType = specification.contentType ?? 'application/json'
              const response: http.Response = {
                status: 200,
                body: encoded,
                headers: { 'Content-Type': contentType },
              }
              endSpanWithResponse({ span, response })
              return response
            }
          } catch (error) {
            if (onError) {
              const result = await onError({
                error: error,
                logger: thisLogger,
                functionName,
                tracer,
                http: { request, serverContext },
              })
              if (result !== undefined) {
                endSpanWithResponse({ span, response: result })
                return result
              }
            }
            const response = mapUnknownError(error)
            endSpanWithResponse({ span, response })
            return response
          }
        }

        const response = await subHandler()
        return { ...response, headers: { ...response.headers } }
      },
    )
  return handler
}

function mapUnknownError(error: unknown): http.Response {
  if (error instanceof exception.InvalidInput) {
    return { status: 400, body: { message: error.message, errors: error.errors, from: error.from } }
  } else if (error instanceof Error) {
    return { status: 500, body: error.message }
  } else {
    return { status: 500, body: 'Internal server error' }
  }
}

function gatherRawRetrieve(
  outputType: model.Type,
  request: http.Request,
): result.Result<retrieve.GenericRetrieve | undefined, http.Response> {
  const rawRetrieve = request.headers['retrieve']
  if (rawRetrieve && typeof rawRetrieve === 'string') {
    try {
      return result.ok(JSON.parse(rawRetrieve))
    } catch {
      const failure = result.fail<http.Response>({ body: 'Invalid JSON on "retrieve" header', status: 500 })
      return failure
    }
  } else {
    return result.ok({})
  }
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

function endSpanWithResponse({ span, response }: { span?: Span; response: http.Response }): void {
  span?.setAttribute(SemanticAttributes.HTTP_STATUS_CODE, response.status)
  const responseHasSuccessStatusCode = 200 <= response.status && response.status <= 299
  const spanStatusCode = responseHasSuccessStatusCode ? SpanStatusCode.OK : SpanStatusCode.ERROR
  span?.setStatus({ code: spanStatusCode })
  span?.end()
}
