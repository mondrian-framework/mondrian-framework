import { functions } from '.'
import { ErrorType, OutputRetrieveCapabilities } from './function'
import { result, retrieve, model } from '@mondrian-framework/model'
import { assertNever } from '@mondrian-framework/utils'
import { SeverityNumber } from '@opentelemetry/api-logs'

/**
 * This middleware checks if the requested selection does not exceed the maximum given depth.
 * @param maxDepth the maximum depth.
 */
export function checkMaxSelectionDepth(
  maxDepth: number,
): functions.Middleware<model.Type, model.Type, ErrorType, OutputRetrieveCapabilities, {}> {
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
): functions.Middleware<model.Type, model.Type, ErrorType, OutputRetrieveCapabilities, {}> {
  return {
    name: 'Check output type',
    apply: async (args, next, thisFunction) => {
      const nextRes: any = await next(args)
      let outputValue
      //Unwrap the value
      if (thisFunction.errors && !nextRes.isOk) {
        return nextRes
      } else if (thisFunction.errors) {
        outputValue = nextRes.value
      } else {
        outputValue = nextRes
      }
      const retrieveType = retrieve.fromType(thisFunction.output, thisFunction.retrieve)
      const defaultRetrieve = retrieveType.isOk ? { select: {} } : {}

      const typeToRespect = retrieve.selectedType(thisFunction.output, args.retrieve ?? defaultRetrieve)
      const respectResult = model.concretise(typeToRespect).decode(outputValue as never, {
        errorReportingStrategy: 'allErrors',
        fieldStrictness: 'allowAdditionalFields',
      })

      if (!respectResult.isOk) {
        args.logger.emit({
          body: 'Invalid output',
          attributes: {
            retrieve: JSON.stringify(retrieve),
            errors: Object.fromEntries(
              respectResult.error.map((v, i) => [
                i,
                { ...v, gotJSON: JSON.stringify(v.got), got: `${v.got}`, path: v.path },
              ]),
            ),
          },
          severityNumber: SeverityNumber.ERROR,
        })

        switch (onFailure) {
          case 'log':
            return outputValue
          case 'throw':
            throw new Error(
              `Invalid output on function ${functionName}. Errors: ${respectResult.error
                .map((v, i) => `(${i + 1}) ${JSON.stringify(v)}`)
                .join('; ')}`,
            )
          default:
            assertNever(onFailure, 'Unexpected onFailure action!')
        }
      }
      if (thisFunction.errors) {
        return result.ok(respectResult.value)
      } else {
        return respectResult.value
      }
    },
  }
}
