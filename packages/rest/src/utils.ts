import { Api, ApiSpecification, FunctionSpecifications } from './api'
import { model } from '@mondrian-framework/model'
import { functions, retrieve } from '@mondrian-framework/module'
import { JSONType, isArray, setTraversingValue, mapObject, http } from '@mondrian-framework/utils'

export function encodeQueryObject(input: JSONType, prefix: string): string {
  return internalEncodeQueryObject(input, prefix).join('&')
}

function internalEncodeQueryObject(input: JSONType, prefix: string): string[] {
  if (input && isArray(input)) {
    const params = []
    for (let i = 0; i < input.length; i++) {
      for (const v of internalEncodeQueryObject(input[i], '')) {
        params.push(`${prefix}[${i}]${v}`)
      }
    }
    return params
  }
  if (typeof input === 'object' && input) {
    const params = []
    for (const [key, value] of Object.entries(input)) {
      for (const v of internalEncodeQueryObject(value === undefined ? null : value, '')) {
        params.push(`${prefix}[${key}]${v}`)
      }
    }
    return params
  }
  return [`=${input?.toString() ?? ''}`]
}

/**
 * FROM { "input[id]": "id", "input[meta][info]": 123 }
 * TO   { id: "id", meta: { info: 123 } }
 */
export function decodeQueryObject(input: Record<string, unknown>, prefix: string): JSONType | undefined {
  const output = {}
  for (const [key, value] of Object.entries(input)) {
    if (!key.startsWith(prefix)) {
      continue
    }
    const path = key.replace(prefix, '').split('][').join('.').replace('[', '').replace(']', '')
    if (path === '') {
      return value as JSONType
    }
    setTraversingValue(value, path, output)
  }
  if (Object.keys(output).length === 0) {
    return undefined
  }
  return output
}

export function getPathsFromSpecification({
  functionName,
  specification,
  prefix,
  maxVersion,
}: {
  functionName: string
  specification: FunctionSpecifications
  prefix: string
  maxVersion: number
}): string[] {
  const paths = []
  for (let i = specification.version?.min ?? 1; i <= (specification.version?.max ?? maxVersion); i++) {
    paths.push(`${prefix}/v${i}${specification.path ?? `/${functionName}`}`)
  }
  return paths
}

/**
 * Checks the validity of a rest api configuration.
 * Checks:
 *  - versions min, max boundaries
 *  - paths syntax
 * @param api the api configuration
 */
export function assertApiValidity(api: ApiSpecification<functions.FunctionInterfaces>) {
  if (api.version < 1 || !Number.isInteger(api.version) || api.version > 100) {
    throw new Error(`Invalid api version. Must be between 1 and 100 and be an integer. Got ${api.version}`)
  }
  for (const [functionName, specifications] of Object.entries(api.functions)) {
    for (const specification of isArray(specifications) ? specifications : [specifications]) {
      //TODO [Good first issue]: Check path syntax, other checks?
      if (
        specification?.version?.max != null &&
        (specification.version.max < 1 ||
          specification.version.max > api.version ||
          !Number.isInteger(specification.version.max))
      ) {
        throw new Error(
          `Invalid version for function ${functionName}. 'max' must be between 1 and ${api.version} and be an integer`,
        )
      }
      if (
        specification?.version?.min != null &&
        (specification.version.min < 1 ||
          specification.version.min > api.version ||
          !Number.isInteger(specification.version.min))
      ) {
        throw new Error(
          `Invalid version for function ${functionName}. 'min' must be between 1 and ${api.version} and be an integer`,
        )
      }
      if (
        specification?.version?.min != null &&
        specification.version.max != null &&
        specification.version.min > specification.version.max
      ) {
        throw new Error(`Invalid version for function ${functionName}. 'min' must be less than or equals to 'max'`)
      }
    }
  }
}

/**
 * Adds all non-entity fields that was excluded in the selection.
 */
export function completeRetrieve(
  retr: retrieve.GenericRetrieve | undefined,
  type: model.Type,
): retrieve.GenericRetrieve | undefined {
  if (!retr) {
    return undefined
  }
  return model.match(type, {
    wrapper: ({ wrappedType }) => completeRetrieve(retr, wrappedType),
    record: ({ fields }) =>
      retrieve.merge(type, retr, {
        select: mapObject(fields, (fieldName, fieldType) => {
          const unwrapped = model.unwrap(fieldType)
          if (unwrapped.kind === model.Kind.Entity) {
            const subRetrieve = (retr.select ?? {})[fieldName]
            if (subRetrieve && subRetrieve !== true) {
              return completeRetrieve(subRetrieve as retrieve.GenericRetrieve, fieldType)
            } else {
              return undefined
            }
          }
          return true
        }),
      }) as retrieve.GenericRetrieve,
    otherwise: () => retr,
  })
}

export function methodFromOptions(options?: functions.FunctionOptions): http.Method {
  if (typeof options?.operation === 'object') {
    if (options.operation.command === 'create') {
      return 'put'
    } else if (options.operation.command === 'delete') {
      return 'delete'
    } else if (options.operation.command === 'update') {
      return 'post'
    }
  }
  return options?.operation === 'query' ? 'get' : 'post'
}
