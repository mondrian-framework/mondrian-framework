import { AfterMiddleware, BeforeMiddleware } from './function'
import { projection, types } from '@mondrian-framework/model'

/**
 * This middleware checks if the requested projection does not exceed the maximum depth given.
 * @param maxDepth the maximum depth.
 */
export function checkMaxProjectionDepth(maxDepth: number): BeforeMiddleware<types.Type, types.Type, {}> {
  return {
    name: 'Check max projection depth',
    apply: ({ args }) => {
      const depth = projection.depth(args.projection ?? true)
      if (depth > maxDepth) {
        throw new Error(
          `Max projection depth reached: requested projection have a depth of ${depth}. The maximum is ${maxDepth}.`,
        )
      }
      return args
    },
  }
}

/**
 * This middleware checks if the result is compatible with the function output type and also if it's respecting the given projection.
 * Returning more fields than requested are allowed.
 * @param onFailure the action to take on failure.
 */
export function checkOutputType(onFailure: 'log' | 'throw'): AfterMiddleware<types.Type, types.Type, {}> {
  return {
    name: 'Check output type',
    apply: async ({ args, thisFunction, result }) => {
      const projectionRespectedResult = projection.respectsProjection(
        thisFunction.output,
        args.projection ?? true,
        result,
      )
      if (!projectionRespectedResult.isOk) {
        const m = JSON.stringify({ projection: args.projection, errors: projectionRespectedResult.error }) //TODO: prettify error?
        if (onFailure === 'log') {
          await args.log(`Invalid output: ${m}`, 'error')
        } else {
          throw new Error(`Invalid output: ${m}`)
        }
      }
      return result
    },
  }
}
