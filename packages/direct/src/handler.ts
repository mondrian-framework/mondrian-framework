import { Api, ServeOptions } from './api'
import { model, result } from '@mondrian-framework/model'
import { functions, logger, module } from '@mondrian-framework/module'
import { http, mapObject } from '@mondrian-framework/utils'
import { SpanKind, SpanStatusCode, Span } from '@opentelemetry/api'
import { SemanticAttributes } from '@opentelemetry/semantic-conventions'

const FailureResponse = model.object({
  success: model.literal(false),
  reason: model.string(),
  additionalInfo: model.unknown(),
})
type FailureResponse = model.Infer<typeof FailureResponse>

const SuccessResponse = (functionBody: functions.FunctionInterface) =>
  model.union({
    result: model.object({
      success: model.literal(true),
      result: model.partialDeep(functionBody.output),
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

const Metadata = model.record(model.string()).optional()

/**
 * Mondrian type a the body that will be returned for a specific function and with a specific retrieve value.
 */
export const Response = (functionBody: functions.FunctionInterface) =>
  model.union({ success: SuccessResponse(functionBody), failire: FailureResponse })
export type Response = SuccessResponse | FailureResponse

/**
 * Gets an http handler with the implementation of the Direct transport for a whole Mondrian module.
 */
export function fromModule<Fs extends functions.FunctionImplementations, ServerContext>({
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

async function handleFunctionCall<Fs extends functions.FunctionImplementations, ServerContext>({
  functionName,
  tracer,
  request,
  options,
  api,
  context,
  serverContext,
}: {
  functionName: string
  tracer: functions.Tracer
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
  const baseLogger = logger.build({
    moduleName: api.module.name,
    operationName: functionName,
    server: 'DIRECT',
  })
  const successResponse = SuccessResponse(functionBody)
  const body = request.body as Record<string, unknown>
  const rawInput = body.input
  const rawRetrieve = body.retrieve
  const rawMetadata = body.metadata
  const metadataResult = Metadata.decode(rawMetadata, options.decodeOptions)
  if (metadataResult.isFailure) {
    return result.fail({
      success: false,
      reason: 'Error while decoding request',
      additionalInfo: {
        path: '$.metadata',
        got: rawMetadata,
        expected: 'object or undefined',
      },
    })
  }

  try {
    const contextInput = await context(serverContext, metadataResult.value)
    const applyResult = await functionBody.rawApply({
      contextInput: contextInput as Record<string, unknown>,
      rawInput,
      rawRetrieve,
      tracer,
      logger: baseLogger,
      decodingOptions: options.decodeOptions,
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
