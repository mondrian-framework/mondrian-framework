import { functions } from '.'
import { projection, types } from '@mondrian-framework/model'

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
        throw new Error(
          `Max projection depth reached: requested projection have a depth of ${depth}. The maximum is ${maxDepth}.`,
        )
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
      const result = await next(args)
      const projectionRespectedResult = projection.respectsProjection(
        thisFunction.output,
        args.projection ?? (true as never),
        result,
      )
      if (!projectionRespectedResult.isOk) {
        //TODO: prettify error?
        const m = JSON.stringify({ projection: args.projection, errors: projectionRespectedResult.error })
        if (onFailure === 'log') {
          await args.log(`Invalid output: ${m}`, 'error')
          return result //return an invalid output is ok in this case
        } else {
          throw new Error(`Invalid output: ${m}`)
        }
      }
      return projectionRespectedResult.value
    },
  }
}
