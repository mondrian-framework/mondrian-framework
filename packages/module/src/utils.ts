import { randomBytes } from 'crypto'
import { GenericProjection } from './projection'
import { GraphQLResolveInfo, Kind, SelectionSetNode } from 'graphql'
import { JSONType, assertNever } from '@mondrian/utils'
import { DecodeResult, LazyType, lazyToType } from '@mondrian/model'

export function encodeQueryObject(input: JSONType, prefix: string): string {
  return internalEencodeQueryObject(input, prefix).join('&')
}

function internalEencodeQueryObject(input: JSONType, prefix: string): string[] {
  if (typeof input === 'object' && input) {
    const params = []
    for (const [key, value] of Object.entries(input)) {
      for (const v of internalEencodeQueryObject(value, '')) {
        params.push(`${prefix}[${key}]${v}`)
      }
    }
    return params
  }
  if (Array.isArray(input)) {
    const params = []
    for (let i = 0; i < input.length; i++) {
      for (const v of internalEencodeQueryObject(input[i], '')) {
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
    const path = key.replace(prefix, '').split('][').join('.').replace('[', '').replace(']', '')
    setTraversingValue(value, path, output)
  }
  return output
}

export function setTraversingValue(value: unknown, path: string, object: Record<string, unknown>) {
  const [head, ...tail] = path.split('.')
  if (tail.length === 0) {
    object[head] = value
    return
  }
  if (!object[head]) {
    object[head] = {}
  }
  setTraversingValue(value, tail.join('.'), object[head] as Record<string, unknown>)
}

export function isVoidType(type: LazyType): boolean {
  const t = lazyToType(type)
  return t.kind === 'custom' && t.name === 'void'
}

export function isNullType(type: LazyType): boolean {
  const t = lazyToType(type)
  return t.kind === 'literal' && t.value === null
}

export function randomOperationId() {
  //same length until Tue, 02 Aug 10889 05:31:50 GMT
  return `${new Date().getTime().toString(16).padStart(12, '0')}-${randomBytes(6).toString('hex')}`
}

export function projectionDepth(p: GenericProjection, start = 0): number {
  if (typeof p === 'object') {
    const max = Object.values(p).reduce((depth, sb) => {
      const d = sb ? projectionDepth(sb, start + 1) : start
      return d > depth ? d : depth
    }, start)
    return max
  }
  return start
}

export function logger(
  moduleName: string,
  operationId: string,
  operationType: string,
  operationName: string,
  driver: string,
  start: Date,
) {
  function l(message: string) {
    console.log(
      `[${operationId}] [${moduleName} / ${operationType}.${operationName} / ${driver}]: ${message} (${
        new Date().getTime() - start.getTime()
      } ms)`,
    )
  }
  return l
}

export function mergeProjections(p1: GenericProjection, p2: GenericProjection): GenericProjection {
  if (p1 === true || p2 === true) return true
  if (p1 === null || p1 === undefined) return p2
  if (p2 === null || p2 === undefined) return p1
  const p1k = Object.keys(p1)
  const p2k = Object.keys(p2)
  const keySet = new Set([...p1k, ...p2k])
  const res: Record<string, GenericProjection> = {}
  for (const key of keySet.values()) {
    res[key] = mergeProjections(p1[key] as GenericProjection, p2[key] as GenericProjection)
  }
  return res
}

function graphqlInfoToProjection(
  node: SelectionSetNode,
  info: GraphQLResolveInfo,
  spreding?: string,
): GenericProjection {
  let result: Record<string, GenericProjection> = {}
  for (const selection of node.selections) {
    if (selection.kind === Kind.FIELD) {
      if (selection.name.value === '__typename') {
        continue
      }
      const name = selection.name.value
      const fields = selection.selectionSet ? graphqlInfoToProjection(selection.selectionSet, info) : true
      result[name] = fields
    } else if (selection.kind === Kind.INLINE_FRAGMENT) {
      if (!selection.typeCondition) {
        throw new Error(`extractFieldsFromGraphqlInfo: unexpected INLINE_FRAGMENT without typeConfition`)
      }
      const name = selection.typeCondition.name.value
      const fields = graphqlInfoToProjection(selection.selectionSet, info, name)
      result[name] = fields
    } else if (selection.kind === Kind.FRAGMENT_SPREAD) {
      const fragmentName = selection.name.value
      const fragment = info.fragments[fragmentName]
      const r = graphqlInfoToProjection(fragment.selectionSet, info)
      const name = fragment.typeCondition.name.value
      result = mergeProjections(result, spreding ? r : { [name]: r }) as Record<string, GenericProjection>
    } else {
      assertNever(selection)
    }
  }
  return result
}

function extractRequiredFields(type: LazyType, fields: GenericProjection): GenericProjection | null {
  if (fields === true) {
    return null
  }
  const t = lazyToType(type)
  if (
    t.kind === 'boolean' ||
    t.kind === 'string' ||
    t.kind === 'number' ||
    t.kind === 'enumerator' ||
    t.kind === 'custom' ||
    t.kind === 'literal'
  ) {
    return null
  }
  if (t.kind === 'array-decorator' || t.kind === 'optional-decorator' || t.kind === 'default-decorator') {
    return extractRequiredFields(t.type, fields)
  }
  if (t.kind === 'object') {
    const p = Object.fromEntries(
      Object.entries(t.type).flatMap(([k, type]) => {
        const subF = fields[k]
        if (!subF) {
          return []
        }
        const subP = extractRequiredFields(type, subF)
        return subP != null ? [[k, subP]] : []
      }),
    )
    if (Object.keys(p).length > 0) {
      return p
    }
    return null
  }
  if (t.kind === 'union-operator') {
    const p = Object.fromEntries(
      Object.entries(t.types).flatMap(([k, type]) => {
        const subF = fields[k]
        if (!subF && !t.opts?.discriminant) {
          return []
        }
        const subP = subF ? extractRequiredFields(type, subF) : null
        const reqP = t.opts?.discriminant ? ({ [t.opts!.discriminant!]: true } as GenericProjection) : null
        const res = subP && reqP ? mergeProjections(reqP, subP) : reqP
        return res != null ? [[k, res]] : []
      }),
    )
    if (Object.keys(p).length > 0) {
      return p
    }
    return null
  }
  assertNever(t)
}

export function extractFieldsFromGraphqlInfo(info: GraphQLResolveInfo, type: LazyType): GenericProjection {
  if (info.fieldNodes.length <= 0) {
    throw new Error('extractFieldsFromGraphqlInfo: info.fieldNodes.length is 0')
  }
  const node = info.fieldNodes[0]
  if (!node.selectionSet) {
    return true
  }
  const fields = graphqlInfoToProjection(node.selectionSet, info)
  const required = extractRequiredFields(type, fields)
  const result = required != null ? mergeProjections(fields, required) : fields
  return result
}

export function firstOf2<V>(f1: () => DecodeResult<V>, f2: () => DecodeResult<V>): DecodeResult<V> {
  const v1 = f1()
  if (!v1.pass) {
    const v2 = f2()
    if (v2.pass) {
      return v2
    }
  }
  return v1
}
