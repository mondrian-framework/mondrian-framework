import { randomBytes } from 'crypto'
import { GenericProjection } from './projection'

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

export type Logger = (message: string, level?: 'log' | 'warn' | 'error') => void | Promise<void>
export function buildLogger(
  moduleName: string,
  operationId: string | null,
  operationType: string | null, //QUERY, MUTATION, GET, POST, SQS-URL ...
  operationName: string | null,
  server: string, //REST, GRAPHQL, LOCAL, ...
  start: Date,
): Logger {
  function l(message: string, level?: 'log' | 'warn' | 'error') {
    const op =
      operationType && operationName
        ? `${operationType} / ${operationName}`
        : operationName
        ? operationName
        : operationType
        ? operationType
        : null
    console[level ?? 'log'](
      `${operationId ? `[${operationId}] ` : ''}[${moduleName}${op ? ` / ${op}` : ''} / ${server}]: ${message} (${
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
