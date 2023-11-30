import { functions, logger, utils } from '.'
import { result, retrieve, model, decoding, validation } from '@mondrian-framework/model'
import { SeverityNumber } from '@opentelemetry/api-logs'

/**
 * This middleware checks if the requested selection does not exceed the maximum given depth.
 * @param maxDepth the maximum depth.
 */
export function checkMaxSelectionDepth(
  maxDepth: number,
): functions.Middleware<model.Type, model.Type, functions.ErrorType, functions.OutputRetrieveCapabilities, {}> {
  return {
    name: 'Check max selection depth',
    apply: (args, next, thisFunction) => {
      const depth = retrieve.selectionDepth(thisFunction.output, args.retrieve ?? {})
      if (depth > maxDepth) {
        const errorMessage = `Max selection depth reached: requested selection have a depth of ${depth}. The maximum is ${maxDepth}.`
        args.logger.emit({
          body: errorMessage,
          attributes: { retrieve: JSON.stringify(retrieve), depth, maxDepth },
          severityNumber: SeverityNumber.WARN,
        })
        throw new Error(errorMessage)
      }
      return next(args)
    },
  }
}

/**
 * This middleware checks if the result is compatible with the function's output type and also if it's respecting the given projection.
 * Returning more fields than requested is allowed and the additional fields will be trimmed out.
 * @param onFailure the action to take on failure.
 */
export function checkOutputType(
  functionName: string,
  onFailure: 'log' | 'throw',
): functions.Middleware<model.Type, model.Type, functions.ErrorType, functions.OutputRetrieveCapabilities, {}> {
  return {
    name: 'Check output type',
    apply: async (args, next, thisFunction) => {
      const nextRes: result.Result<unknown, unknown> | unknown = await next(args)
      if (thisFunction.errors && (nextRes as result.Result<unknown, unknown>).isFailure) {
        //Checks the error type
        const errorDecodeResult = utils.decodeFunctionFailure(
          (nextRes as result.Failure<unknown>).error,
          thisFunction.errors,
          {
            errorReportingStrategy: 'allErrors',
            fieldStrictness: 'expectExactFields',
          },
        )
        if (errorDecodeResult.isFailure) {
          handleFailure({ onFailure, functionName, logger: args.logger, result: errorDecodeResult })
        }
        return errorDecodeResult.isOk ? result.fail(errorDecodeResult.value) : nextRes
      }

      //Unwrap the value
      let outputValue
      if (thisFunction.errors) {
        outputValue = (nextRes as result.Ok<unknown>).value
      } else {
        outputValue = nextRes
      }
      const retrieveType = retrieve.fromType(thisFunction.output, thisFunction.retrieve)
      const defaultRetrieve = retrieveType.isOk ? { select: {} } : {}

      const typeToRespect = retrieve.selectedType(thisFunction.output, args.retrieve ?? defaultRetrieve)
      const valueDecodeResult = model.concretise(typeToRespect).decode(outputValue as never, {
        errorReportingStrategy: 'allErrors',
        fieldStrictness: 'allowAdditionalFields',
      })

      if (valueDecodeResult.isFailure) {
        handleFailure({ onFailure, functionName, logger: args.logger, result: valueDecodeResult })
        return outputValue
      } else if (thisFunction.errors) {
        return result.ok(valueDecodeResult.value)
      } else {
        return valueDecodeResult.value
      }
    },
  }
}

function handleFailure({
  onFailure,
  logger,
  result,
  functionName,
}: {
  result: result.Failure<decoding.Error[] | validation.Error[]>
  onFailure: 'log' | 'throw'
  logger: logger.MondrianLogger
  functionName: string
}): void {
  if (onFailure === 'log') {
    logger.emit({
      body: 'Invalid output',
      attributes: {
        retrieve: JSON.stringify(retrieve),
        errors: Object.fromEntries(
          result.error.map((v, i) => [i, { ...v, gotJSON: JSON.stringify(v.got), got: `${v.got}`, path: v.path }]),
        ),
      },
      severityNumber: SeverityNumber.ERROR,
    })
  } else {
    throw new Error(
      `Invalid output on function ${functionName}. Errors: ${result.error
        .map((v, i) => `(${i + 1}) ${JSON.stringify(v)}`)
        .join('; ')}`,
    )
  }
}
