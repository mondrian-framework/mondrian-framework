import { RestApi, RestFunctionSpecs } from './api'
import { functions } from '@mondrian-framework/module'
import { JSONType, isArray, setTraversingValue } from '@mondrian-framework/utils'

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
export function decodeQueryObject(input: Record<string, unknown>, prefix: string): JSONType {
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
  return output
}

export function getPathFromSpecification(functionName: string, spec: RestFunctionSpecs, prefix: string): string {
  return `${prefix}/:v${spec.path ?? `/${functionName}`}`
}

export function getMaxApiVersion(api: RestApi<functions.Functions>): number {
  return Object.values(api.functions)
    .flatMap((v) => (v ? (isArray(v) ? v : [v]) : []))
    .map((v) => Math.max(v.version?.max ?? 0, v.version?.min ?? 0))
    .reduce((p, c) => Math.max(p, c), api.version ?? 1)
}
