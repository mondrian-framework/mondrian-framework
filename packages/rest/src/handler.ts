import { ApiSpecification, ErrorHandler, FunctionSpecifications } from './api'
import { CustomTypeSpecifications, clearInternalData, emptyInternalData, generateOpenapiInput } from './openapi'
import { completeRetrieve, decodeQueryObject, methodFromOptions } from './utils'
import { model } from '@mondrian-framework/model'
import { exception, functions, logger, module, retrieve } from '@mondrian-framework/module'
import { http, mapObject } from '@mondrian-framework/utils'
import { SpanKind, SpanStatusCode, Span } from '@opentelemetry/api'
import {
  SEMATTRS_HTTP_METHOD,
  SEMATTRS_HTTP_ROUTE,
  SEMATTRS_HTTP_STATUS_CODE,
} from '@opentelemetry/semantic-conventions'

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
      `${request.method.toUpperCase()} ${request.route}`,
      {
        attributes: {
          [SEMATTRS_HTTP_METHOD]: request.method,
          [SEMATTRS_HTTP_ROUTE]: request.route,
        },
        kind: SpanKind.SERVER,
      },
      async (span) => {
        //Setup logging
        const tracer = functionBody.tracer.withPrefix(`mondrian:rest:${functionName}:`)

        const subHandler = async () => {
          try {
            //Decode input
            const rawInput = gatherRawInput(request)

            //Decode retrieve
            const rawRetrieve = gatherRawRetrieve(request)

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

function gatherRawRetrieve(request: http.Request): retrieve.GenericRetrieve {
  const where = decodeQueryObject(request.query, 'where')
  const orderBy = decodeQueryObject(request.query, 'orderBy')
  const select = decodeQueryObject(request.query, 'select')
  const skip = request.query['skip']
  const take = request.query['take']
  return { where, orderBy, select, skip, take } as retrieve.GenericRetrieve
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
  span?.setAttribute(SEMATTRS_HTTP_STATUS_CODE, response.status)
  const responseHasSuccessStatusCode = 200 <= response.status && response.status <= 299
  const spanStatusCode = responseHasSuccessStatusCode ? SpanStatusCode.OK : SpanStatusCode.ERROR
  span?.setStatus({ code: spanStatusCode })
  span?.end()
}
