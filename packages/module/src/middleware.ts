import { functions } from '.'
import { projection, result, types, validation } from '@mondrian-framework/model'
import { SeverityNumber } from '@opentelemetry/api-logs'

/**
 * This middleware checks if the requested projection does not exceed the maximum given depth.
 * @param maxDepth the maximum depth.
 */
export function checkMaxProjectionDepth(maxDepth: number): functions.Middleware<types.Type, types.Type, {}> {
  return {
    name: 'Check max projection depth',
    apply: (args, next) => {
      const depth = projection.depth(args.projection ?? true)
      if (depth > maxDepth) {
        const errorMessage = `Max projection depth reached: requested projection have a depth of ${depth}. The maximum is ${maxDepth}.`
        args.logger.emit({
          body: errorMessage,
          attributes: {
            projection: JSON.stringify(projection),
            depth,
            maxDepth,
          },
          severityNumber: SeverityNumber.WARN,
        })
        throw new Error(errorMessage)
      }
      return next(args)
    },
  }
}

/**
 * This middleware checks if the result is compatible with the function output type and also if it's respecting the given projection.
 * Returning more fields than requested are allowed and it will be trimmed out (if it's respects the projection).
 * @param onFailure the action to take on failure.
 */
export function checkOutputType(onFailure: 'log' | 'throw'): functions.Middleware<types.Type, types.Type, {}> {
  return {
    name: 'Check output type',
    apply: async (args, next, thisFunction) => {
      const res = await next(args)
      const outputPartialDeepType = types.concretise(types.partialDeep(thisFunction.output))
      const checkResult = (
        projection.respectsProjection(thisFunction.output, args.projection ?? (true as never), res) as result.Result<
          never,
          projection.Error[] | validation.Error[]
        >
      ).chain((trimmed) => outputPartialDeepType.validate(trimmed).map(() => trimmed))
      if (!checkResult.isOk) {
        const errorsMessage = JSON.stringify(checkResult.error)
        args.logger.emit({
          body: 'Invalid output',
          attributes: {
            projection: JSON.stringify(projection),
            output: JSON.stringify(
              outputPartialDeepType.encodeWithoutValidation(res, { sensitiveInformationStrategy: 'hide' }),
            ),
            errors: errorsMessage,
          },
          severityNumber: SeverityNumber.ERROR,
        })

        if (onFailure === 'log') {
          return res //return an invalid output is ok in this case
        } else {
          throw new Error(`Invalid output: ${errorsMessage}`)
        }
      }

      return checkResult.value
    },
  }
}
