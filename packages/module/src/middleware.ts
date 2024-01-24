import { exception, functions, logger, retrieve, security, utils } from '.'
import { checkPolicies as checkPolicyInternal } from './security'
import { result, model, decoding, validation, path } from '@mondrian-framework/model'
import { buildErrorMessage } from '@mondrian-framework/utils'

/**
 * This middleware checks if the requested selection does not exceed the maximum given depth.
 * @param maxDepth the maximum depth.
 */
export function checkMaxSelectionDepth(
  maxDepth: number,
): functions.Middleware<
  model.Type,
  model.Type,
  functions.ErrorType,
  functions.OutputRetrieveCapabilities,
  functions.Providers,
  functions.Guards
> {
  return {
    name: 'Check max selection depth',
    apply: (args, next, thisFunction) => {
      const depth = retrieve.selectionDepth(thisFunction.output, args.retrieve ?? {})
      if (depth > maxDepth) {
        throw new exception.MaxSelectionDepthReached(depth, maxDepth)
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
): functions.Middleware<
  model.Type,
  model.Type,
  functions.ErrorType,
  functions.OutputRetrieveCapabilities,
  functions.Providers,
  functions.Guards
> {
  return {
    name: 'Check output type',
    apply: async (args, next, thisFunction) => {
      const originalResult = await next(args)
      if (originalResult.isFailure) {
        if (!thisFunction.errors) {
          throw new Error(
            `Unexpected failure on function ${functionName}. It doesn't declare errors nor the module declares errors.`,
          )
        }
        const mappedError = utils.decodeFunctionFailure(originalResult.error, thisFunction.errors, {
          errorReportingStrategy: 'allErrors',
          fieldStrictness: 'expectExactFields',
        })
        if (mappedError.isFailure) {
          handleFailure({ onFailure, functionName, logger: args.logger, result: mappedError })
          return originalResult
        }
        return originalResult
      }

      const retrieveType = retrieve.fromType(thisFunction.output, thisFunction.retrieve)
      const defaultRetrieve = retrieveType.isOk ? { select: {} } : {}

      const typeToRespect = retrieve.selectedType(thisFunction.output, args.retrieve ?? defaultRetrieve)
      const mappedResult = model.concretise(typeToRespect).decode(originalResult.value as never, {
        errorReportingStrategy: 'allErrors',
        fieldStrictness: 'allowAdditionalFields',
      })

      if (mappedResult.isFailure) {
        handleFailure({ onFailure, functionName, logger: args.logger, result: mappedResult })
        return originalResult
      }
      return mappedResult as result.Ok<never>
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
    logger.logWarn(
      buildErrorMessage(`Invalid value returned by the function ${functionName}`, 'module/middleware/checkOutputType'),
      {
        retrieve: JSON.stringify(retrieve),
        errors: Object.fromEntries(
          result.error.map((v, i) => [i, { ...v, gotJSON: JSON.stringify(v.got), got: `${v.got}`, path: v.path }]),
        ),
      },
    )
  } else {
    throw new exception.InvalidOutputValue(functionName, result.error)
  }
}

/**
 * This middleware applies the given security policies for a retrieve operation.
 * In case the checks fails and {@link exception.UnauthorizedAccess} is thrown
 */
export function checkPolicies(
  policies: (
    args: functions.FunctionArguments<
      model.Type,
      model.Type,
      model.Types,
      functions.OutputRetrieveCapabilities,
      functions.Providers
    >,
  ) => security.Policies,
): functions.Middleware<
  model.Type,
  model.Type,
  functions.ErrorType,
  functions.OutputRetrieveCapabilities,
  functions.Providers,
  functions.Guards
> {
  return {
    name: 'Check policies',
    apply: (args, next, thisFunction) => {
      const res = checkPolicyInternal({
        outputType: thisFunction.output,
        retrieve: args.retrieve,
        policies: policies(args),
        capabilities: thisFunction.retrieve,
        path: path.root,
      })
      if (!res.isOk) {
        throw new exception.UnauthorizedAccess(res.error)
      }
      return next({ ...args, retrieve: res.value ?? {} })
    },
  }
}
