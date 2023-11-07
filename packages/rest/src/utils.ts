import { Api, FunctionSpecifications } from './api'
import { retrieve, types } from '@mondrian-framework/model'
import { functions } from '@mondrian-framework/module'
import { JSONType, isArray, setTraversingValue, mapObject, flatMapObject } from '@mondrian-framework/utils'

export function encodeQueryObject(input: JSONType, prefix: string): string {
  return internalEncodeQueryObject(input, prefix).join('&')
}

function internalEncodeQueryObject(input: JSONType, prefix: string): string[] {
  if (typeof input === 'object' && input) {
    const params = []
    for (const [key, value] of Object.entries(input)) {
      for (const v of internalEncodeQueryObject(value === undefined ? null : value, '')) {
        params.push(`${prefix}[${key}]${v}`)
      }
    }
    return params
  }
  if (Array.isArray(input)) {
    const params = []
    for (let i = 0; i < input.length; i++) {
      for (const v of internalEncodeQueryObject(input[i], '')) {
        params.push(`${prefix}[${i}]${v}`)
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
      if (Array.isArray(value)) {
        return value.map((v) => JSON.parse(v as string))
      }
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
  globalMaxVersion,
}: {
  functionName: string
  specification: FunctionSpecifications
  prefix: string
  globalMaxVersion: number
}): string[] {
  const paths = []
  for (let i = specification.version?.min ?? 1; i <= (specification.version?.max ?? globalMaxVersion); i++) {
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
export function assertApiValidity<Fs extends functions.Functions, ContextInput>(api: Api<Fs, ContextInput>) {
  if (api.version < 1 || !Number.isInteger(api.version) || api.version > 100) {
    throw new Error(`Invalid api version. Must be between 1 and 100 and be an integer. Got ${api.version}`)
  }
  for (const [functionName, specifications] of Object.entries(api.functions)) {
    for (const specification of Array.isArray(specifications) ? specifications : [specifications]) {
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
 * Add all non-entity fields that was excluded in the selection will be included.
 */
export function completeRetrieve(
  retr: retrieve.GenericRetrieve | undefined,
  type: types.Type,
): retrieve.GenericRetrieve | undefined {
  if (!retr) {
    return undefined
  }
  //TODO: GenericRetrieve could be inside an object
  return types.match(type, {
    wrapper: ({ wrappedType }) => completeRetrieve(retr, wrappedType),
    entity: ({ fields }) =>
      retrieve.merge(type, retr, {
        select: mapObject(fields, (fieldName, fieldType) => {
          if (types.unwrap(fieldType).kind === types.Kind.Entity) {
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
    object: ({ fields }) =>
      flatMapObject(fields, (fieldName, fieldType) =>
        types.match(types.unwrap(fieldType), {
          entity: (_, entity) =>
            [[fieldName, completeRetrieve(((retr ?? {}) as any)[fieldName], entity)]] as [
              string,
              retrieve.GenericRetrieve,
            ][],
          otherwise: () => [],
        }),
      ),
    otherwise: () => retr,
  })
}
