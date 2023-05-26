import { GenericProjection, LazyType, lazyToType } from '@mondrian-framework/model'
import { randomBytes } from 'crypto'

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
