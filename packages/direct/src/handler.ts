import { Api, ServeOptions } from './api'
import { model, result } from '@mondrian-framework/model'
import { functions, logger, module, retrieve, utils } from '@mondrian-framework/module'
import { http, mapObject } from '@mondrian-framework/utils'
import { SpanKind, SpanStatusCode, Span } from '@opentelemetry/api'
import { SemanticAttributes } from '@opentelemetry/semantic-conventions'

const FailureResponse = model.object({
  success: model.literal(false),
  reason: model.string(),
  additionalInfo: model.unknown(),
})
type FailureResponse = model.Infer<typeof FailureResponse>

const SuccessResponse = (functionBody: functions.FunctionInterface, retr: retrieve.GenericRetrieve | undefined) =>
  model.union({
    result: model.object({
      success: model.literal(true),
      result: functionBody.retrieve ? retrieve.selectedType(functionBody.output, retr) : functionBody.output,
    }),
    failure: model.object({
      success: model.literal(true),
      failure: functionBody.errors
        ? model.object(mapObject(functionBody.errors, (_, errorType) => model.optional(errorType)))
        : model.unknown(),
    }),
  })
type SuccessResponse = {
  success: true
  result: unknown
}

/**
 * Mondrian type a the body that will be returned for a specific function and with a specific retrieve value.
 */
export const Response = (functionBody: functions.FunctionInterface, retr: retrieve.GenericRetrieve | undefined) =>
  model.union({ success: SuccessResponse(functionBody, retr), failire: FailureResponse })
export type Response = SuccessResponse | FailureResponse

/**
 * Gets an http handler with the implementation of the Direct transport for a whole Mondrian module.
 */
export function fromModule<Fs extends functions.Functions, ServerContext>({
  api,
  context,
  options,
}: {
  api: Api<Fs, any>
  context: (
    serverContext: ServerContext,
    metadata: Record<string, string> | undefined,
  ) => Promise<module.FunctionsToContextInput<Fs>>
  options: ServeOptions
}): http.Handler<ServerContext, unknown, Response> {
  function wrapResponse(value: Response): http.Response<Response> {
    return { body: value, status: 200, headers: { 'Content-Type': 'application/json' } }
  }

  const exposedFunctions = new Set(Object.keys(api.module.functions).filter((fn) => !api.exclusions[fn]))
  const requestInputTypeMap = mapObject(api.module.functions, (functionName, functionBody) => {
    const retrieveType = retrieve.fromType(functionBody.output, functionBody.retrieve)
    return model.object({
      function: model.literal(functionName),
      input: functionBody.input as model.UnknownType,
      ...(retrieveType.isOk ? { retrieve: model.optional(retrieveType.value) as unknown as model.UnknownType } : {}),
      metadata: model.record(model.string()).optional(),
    })
  })
  const handler: http.Handler<ServerContext, unknown, Response> = async ({ request, serverContext }) => {
    const functionNameResult = getFunctionName(request, exposedFunctions)
    if (functionNameResult.isFailure) {
      return wrapResponse(functionNameResult.error)
    }
    const functionName = functionNameResult.value
    const functionBody = api.module.functions[functionName]
    const tracer = functionBody.tracer.withPrefix(`mondrian:direct-handler:${functionName}:`)
    return functionBody.tracer.startActiveSpanWithOptions(
      `mondrian:direct-handler:${functionName}`,
      {
        attributes: {
          [SemanticAttributes.HTTP_METHOD]: request.method,
          [SemanticAttributes.HTTP_ROUTE]: request.route,
        },
        kind: SpanKind.SERVER,
      },
      async (span) => {
        const result = await handleFunctionCall({
          functionName,
          api,
          context,
          options,
          request,
          requestInputTypeMap,
          serverContext,
          tracer,
        })
        endSpanWithResult(span, result)
        const response = result.match(
          (v) => v,
          (e) => e,
        )
        return wrapResponse(response)
      },
    )
  }
  return handler
}

async function handleFunctionCall<Fs extends functions.Functions, ServerContext>({
  functionName,
  tracer,
  requestInputTypeMap,
  request,
  options,
  api,
  context,
  serverContext,
}: {
  functionName: string
  tracer: functions.Tracer
  requestInputTypeMap: Record<string, model.ConcreteType>
  request: http.Request
  options: ServeOptions
  api: Api<Fs, any>
  serverContext: ServerContext
  context: (
    serverContext: ServerContext,
    metadata: Record<string, string> | undefined,
  ) => Promise<module.FunctionsToContextInput<Fs>>
}): Promise<result.Result<SuccessResponse, FailureResponse>> {
  const functionBody = api.module.functions[functionName]
  const decodedRequest = tracer.startActiveSpan('decode-input', (span) =>
    endSpanWithResult(
      span,
      requestInputTypeMap[functionName].decode(request.body, options.decodeOptions).mapError((error) => ({
        success: false,
        reason: 'Error while decoding request',
        additionalInfo: error,
      })),
    ),
  )
  if (decodedRequest.isFailure) {
    return decodedRequest
  }
  const baseLogger = logger.build({
    moduleName: api.module.name,
    operationName: functionName,
    server: 'DIRECT',
  })
  const { input, metadata, retrieve: thisRetrieve } = decodedRequest.value
  const successResponse = SuccessResponse(functionBody, thisRetrieve)

  try {
    const contextInput = await context(serverContext, metadata)
    const applyResult = await functionBody.apply({
      contextInput: contextInput as Record<string, unknown>,
      input,
      tracer: functionBody.tracer,
      retrieve: thisRetrieve,
      logger: baseLogger,
    })
    const response = successResponse.encodeWithoutValidation({
      success: true,
      ...(applyResult.isOk ? { result: applyResult.value as never } : { failure: applyResult.error as never }),
    }) as SuccessResponse
    return result.ok(response)
  } catch (error) {
    return result.fail({
      success: false,
      reason: error instanceof Error ? 'Function throws error' : 'Function throws',
      additionalInfo: error instanceof Error ? error.message : error,
    })
  }
}

function getFunctionName(
  request: http.Request,
  exposedFunctions: ReadonlySet<string>,
): result.Result<string, Response> {
  if (exposedFunctions.size === 0) {
    return result.fail({
      success: false,
      reason: 'No function available',
      additionalInfo: 'This module does not expose any function',
    })
  }
  const functionName =
    typeof request.body === 'object' && request.body && 'function' in request.body ? request.body.function : undefined
  if (typeof functionName !== 'string' || !exposedFunctions.has(functionName)) {
    return result.fail({
      success: false,
      reason: 'Error while decoding request',
      additionalInfo: {
        path: '$.function',
        got: functionName,
        expected: `One of [${[...exposedFunctions.keys()].map((v) => `'${v}'`).join(', ')}]`,
      },
    })
  }
  return result.ok(functionName)
}

function endSpanWithResult<A, E>(span: Span | undefined, result: result.Result<A, E>): result.Result<A, E> {
  if (result.isOk) {
    span?.setStatus({ code: SpanStatusCode.OK })
    span?.end()
  } else {
    span?.setStatus({ code: SpanStatusCode.ERROR, message: JSON.stringify(result.error) })
    span?.end()
  }
  return result
}
