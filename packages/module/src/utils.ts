import crypto from 'crypto'

/**
 * Generates a random operation id.
 * It's a UUID v4.
 *
 * @returns new random operation id.
 */
export function randomOperationId() {
  return crypto.randomUUID()
}
