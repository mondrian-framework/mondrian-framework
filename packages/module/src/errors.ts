import { security } from '@mondrian-framework/model'

export class UnauthorizedAccess extends Error {
  public readonly error: security.PolicyError
  constructor(error: security.PolicyError) {
    super(`Unauthorized access.`)
    this.error = error
  }
}
