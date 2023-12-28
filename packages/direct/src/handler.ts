import { Api, ServeOptions } from './api'
import { model, result } from '@mondrian-framework/model'
import { functions, logger, module, retrieve, utils } from '@mondrian-framework/module'
import { JSONType, http, mapObject } from '@mondrian-framework/utils'

const FailureResponse = model.object({
  success: model.literal(false),
  reason: model.string(),
  additionalInfo: model.unknown(),
})

const SuccessResponse = (functionBody: functions.FunctionInterface, retr: retrieve.GenericRetrieve | undefined) =>
  model.union({
    result: model.object({
      success: model.literal(true),
      operationId: model.string(),
      result: functionBody.retrieve ? retrieve.selectedType(functionBody.output, retr) : functionBody.output,
    }),
    failure: model.object({
      success: model.literal(true),
      operationId: model.string(),
      failure: functionBody.errors
        ? model.object(mapObject(functionBody.errors, (_, errorType) => model.optional(errorType)))
        : model.unknown(),
    }),
  })

/**
 * Mondrian type a the body that will be returned for a specific function and with a specific retrieve value.
 */
export const Response = (functionBody: functions.FunctionInterface, retr: retrieve.GenericRetrieve | undefined) =>
  model.union({ success: SuccessResponse(functionBody, retr), failire: FailureResponse })

/**
 * Gets an http handler with the implementation of the Direct transport for a whole Mondrian module.
 */
export function fromModule<Fs extends functions.Functions, ServerContext, ContextInput>({
  api,
  context,
  options,
}: {
  api: Api<Fs, any, ContextInput>
  context: (serverContext: ServerContext, metadata: Record<string, string> | undefined) => Promise<ContextInput>
  options: ServeOptions
}): http.Handler<ServerContext> {
  const exposedFunctions = Object.keys(api.module.functions).filter((fn) => !api.exclusions[fn])
  const requestInputTypeMap = mapObject(api.module.functions, (functionName, functionBody) => {
    const retrieveType = retrieve.fromType(functionBody.output, functionBody.retrieve)
    return model.object({
      function: model.literal(functionName),
      ...(model.isNever(functionBody.input) ? {} : { input: functionBody.input as model.UnknownType }),
      ...(retrieveType.isOk ? { retrieve: model.optional(retrieveType.value) as unknown as model.UnknownType } : {}),
      metadata: model.record(model.string()).optional(),
    })
  })
  const handler: http.Handler<ServerContext> = async ({ request, serverContext }) => {
    if (exposedFunctions.length === 0) {
      const response = FailureResponse.encodeWithoutValidation({
        success: false,
        reason: 'No function available',
        additionalInfo: 'This module does not expose any function',
      })
      return wrapResponse(response)
    }

    const functionName =
      typeof request.body === 'object' && request.body && 'function' in request.body ? request.body.function : undefined

    if (typeof functionName !== 'string' || !(functionName in requestInputTypeMap)) {
      const response = FailureResponse.encodeWithoutValidation({
        success: false,
        reason: 'Error while decoding request',
        additionalInfo: {
          path: '$.function',
          got: functionName,
          expected: `One of [${exposedFunctions.map((v) => `'${v}'`).join(', ')}]`,
        },
      })
      return wrapResponse(response)
    }

    const decodedRequest = requestInputTypeMap[functionName].decode(request.body, options.decodeOptions)
    if (decodedRequest.isFailure) {
      const response = FailureResponse.encodeWithoutValidation({
        success: false,
        reason: 'Error while decoding request',
        additionalInfo: decodedRequest.error,
      })
      return wrapResponse(response)
    }

    const operationId = utils.randomOperationId()
    const baseLogger = logger.build({ moduleName: api.module.name, server: 'DIRECT' })
    const { input, metadata, retrieve: thisRetrieve } = decodedRequest.value
    const functionBody = api.module.functions[functionName]
    const successResponse = SuccessResponse(functionBody, thisRetrieve)

    try {
      const contextInput = await context(serverContext, metadata)
      const contextValue = await api.module.context(contextInput, {
        functionName,
        input,
        operationId,
        retrieve: thisRetrieve,
        logger: baseLogger,
      })
      const functionReturn = await functionBody.apply({
        context: contextValue,
        input,
        operationId,
        retrieve: thisRetrieve,
        logger: baseLogger,
      })
      const functionResult: result.Result<unknown, unknown> = functionBody.errors
        ? functionReturn
        : result.ok(functionReturn)
      const response = successResponse.encodeWithoutValidation({
        success: true,
        operationId,
        ...(functionResult.isOk
          ? { result: functionResult.value as never }
          : { failure: functionResult.error as never }),
      })
      return wrapResponse(response)
    } catch (error) {
      const response = FailureResponse.encodeWithoutValidation({
        success: false,
        reason: error instanceof Error ? 'Function throws error' : 'Function throws',
        additionalInfo: error instanceof Error ? error.message : error,
      })
      return wrapResponse(response)
    }
  }
  return handler
}

function wrapResponse(value: JSONType): http.Response {
  return { body: value, status: 200, headers: { 'Content-Type': 'application/json' } }
}
