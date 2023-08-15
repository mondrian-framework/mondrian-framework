import { randomBytes } from 'crypto'

/**
 * Generates a random operation id.
 * It consist in 12 hex digits representing the current unix timestamp, concatenated to 12 random hex digits.
 *
 * Example: "0189f65bc15c-f5eb23da9a29"
 *
 * @returns new random operation id.
 */
export function randomOperationId() {
  //Same length until Tue, 02 Aug 10889 05:31:50 GMT.
  return `${new Date().getTime().toString(16).padStart(12, '0')}-${randomBytes(6).toString('hex')}`
}
