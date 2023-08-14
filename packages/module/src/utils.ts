import { randomBytes } from 'crypto'

/**
 * @returns new random operation id.
 */
export function randomOperationId() {
  //same length until Tue, 02 Aug 10889 05:31:50 GMT
  return `${new Date().getTime().toString(16).padStart(12, '0')}-${randomBytes(6).toString('hex')}`
}
