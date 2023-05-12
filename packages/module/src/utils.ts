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
