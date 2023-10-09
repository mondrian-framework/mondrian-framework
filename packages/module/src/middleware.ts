import { functions } from '.'
import { ErrorType } from './function'
import { projection, types } from '@mondrian-framework/model'
import { assertNever } from '@mondrian-framework/utils'
import { SeverityNumber } from '@opentelemetry/api-logs'

/**
 * This middleware checks if the requested projection does not exceed the maximum given depth.
 * @param maxDepth the maximum depth.
 */
export function checkMaxProjectionDepth(maxDepth: number): functions.Middleware<types.Type, types.Type, ErrorType, {}> {
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
 * This middleware checks if the result is compatible with the function's output type and also if it's respecting the given projection.
 * Returning more fields than requested is allowed and the additional fields will be trimmed out.
 * @param onFailure the action to take on failure.
 */
export function checkOutputType(
  onFailure: 'log' | 'throw',
): functions.Middleware<types.Type, types.Type, ErrorType, {}> {
  return {
    name: 'Check output type',
    apply: async (args, next, thisFunction) => {
      const nextRes: any = await next(args)
      let res
      if (thisFunction.error && !nextRes.isOk) {
        return nextRes as never
      } else if (thisFunction.error) {
        res = nextRes.value
      } else {
        res = nextRes
      }

      const outputPartialDeepType = types.concretise(types.partialDeep(thisFunction.output))
      const checkResult = projection
        .respectsProjection(thisFunction.output, args.projection ?? (true as never), res as never)
        .chain((trimmed) => outputPartialDeepType.validate(trimmed).replace(trimmed))

      if (!checkResult.isOk) {
        const errorsMessage = JSON.stringify(checkResult.error)
        args.logger.emit({
          body: 'Invalid output',
          attributes: {
            projection: JSON.stringify(projection),
            output: JSON.stringify(
              outputPartialDeepType.encodeWithoutValidation(res as never, { sensitiveInformationStrategy: 'hide' }),
            ),
            errors: errorsMessage,
          },
          severityNumber: SeverityNumber.ERROR,
        })

        switch (onFailure) {
          case 'log':
            return res as never
          case 'throw':
            throw new Error(`Invalid output: ${errorsMessage}`)
          default:
            assertNever(onFailure)
        }
      }
      // Swrappare
      return checkResult as never
    },
  }
}
