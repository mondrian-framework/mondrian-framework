import { model, result } from '@mondrian-framework/model'
import { functions, logger, module, retrieve, utils } from '@mondrian-framework/module'
import { http, mapObject } from '@mondrian-framework/utils'

export const FailureResponse = model.object({
  success: model.literal(false),
  reason: model.string(),
  additionalInfo: model.unknown(),
})

export const SuccessResponse = (
  functionBody: functions.FunctionInterface,
  retr: retrieve.GenericRetrieve | undefined,
) =>
  model.object({
    success: model.literal(true),
    operationId: model.string(),
    result: model.union({
      ok: model.object({
        isOk: model.literal(true),
        value: functionBody.retrieve ? retrieve.selectedType(functionBody.output, retr) : functionBody.output,
      }),
      failure: model.object({
        isOk: model.literal(false),
        errors: functionBody.errors
          ? model.object(mapObject(functionBody.errors, (_, errorType) => model.optional(errorType)))
          : model.unknown(),
      }),
    }),
  })

export const Response = (functionBody: functions.FunctionInterface, retr: retrieve.GenericRetrieve | undefined) =>
  model.union({ success: SuccessResponse(functionBody, retr), failire: FailureResponse })

export function fromModule<Fs extends functions.Functions, ContextInput>({
  module,
  context: contextBuilder,
}: {
  module: module.Module<Fs, ContextInput>
  context: (metadata: Record<string, string> | undefined, request: http.Request) => Promise<ContextInput>
}): http.Handler {
  const exposedFunctions = Object.keys(module.functions)

  const requestInputTypeMap = mapObject(module.functions, (functionName, functionBody) => {
    const retrieveType = retrieve.fromType(functionBody.output, functionBody.retrieve)
    return model.object({
      functionName: model.literal(functionName),
      ...(model.isNever(functionBody.input) ? {} : { input: functionBody.input as model.UnknownType }),
      ...(retrieveType.isOk ? { retrieve: retrieveType.value as unknown as model.UnknownType } : {}),
      metadata: model.record(model.string()).optional(),
    })
  })

  const handler: (request: http.Request) => Promise<http.Response> = async (request) => {
    if (exposedFunctions.length === 0) {
      const response = FailureResponse.encodeWithoutValidation({
        success: false,
        reason: 'No function available',
        additionalInfo: 'This module does not expose any function',
      })
      return { body: response, status: 200 }
    }

    const functionName =
      typeof request.body === 'object' && request.body && 'functionName' in request.body
        ? request.body.functionName
        : null

    if (typeof functionName !== 'string' || !(functionName in requestInputTypeMap)) {
      const response = FailureResponse.encodeWithoutValidation({
        success: false,
        reason: 'Error while decoding request',
        additionalInfo: {
          path: '$.functionName',
          got: functionName,
          expected: `One of [${exposedFunctions.map((v) => `'${v}'`).join(', ')}]`,
        },
      })
      return { body: response, status: 200 }
    }

    const decodedRequest = requestInputTypeMap[functionName].decode(request.body, {
      errorReportingStrategy: 'stopAtFirstError',
      fieldStrictness: 'expectExactFields',
      typeCastingStrategy: 'expectExactTypes',
    })

    if (decodedRequest.isFailure) {
      const response = FailureResponse.encodeWithoutValidation({
        success: false,
        reason: 'Error while decoding request',
        additionalInfo: decodedRequest.error,
      })
      return { body: response, status: 200 }
    }

    const operationId = utils.randomOperationId()
    const baseLogger = logger.build({ moduleName: module.name, server: 'DIRECT' })
    const { input, metadata, retrieve: thisRetrieve } = decodedRequest.value
    const functionBody = module.functions[functionName]
    const successResponse = SuccessResponse(functionBody, thisRetrieve)

    try {
      const contextInput = await contextBuilder(metadata, request)
      const context = await module.context(contextInput, {
        functionName,
        input,
        operationId,
        retrieve: thisRetrieve,
        logger: baseLogger,
      })
      const functionReturn = await functionBody.apply({
        context,
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
        result: functionResult.isOk
          ? {
              isOk: true,
              value: functionResult.value as never,
            }
          : {
              isOk: false,
              errors: functionResult.error as never,
            },
      })
      return { body: response, status: 200 }
    } catch (error) {
      const response = FailureResponse.encodeWithoutValidation({
        success: false,
        reason: error instanceof Error ? 'Function throws error' : 'Function throws',
        additionalInfo: error instanceof Error ? error.message : error,
      })
      return { body: response, status: 200 }
    }
  }
  return handler
}
