//Errors thrown by the module
import { security } from '@mondrian-framework/model'

export class InvalidJwtError extends Error {
  public readonly jwt: string
  constructor(jwt: string) {
    super(`Invalid JWT`)
    this.jwt = jwt
  }
}

export class UnauthorizedAccess extends Error {
  public readonly error: security.PolicyError
  constructor(error: security.PolicyError) {
    super(`Unauthorized access.`)
    this.error = error
  }
}
