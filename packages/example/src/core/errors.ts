//Errors thrown by the module

export class InvalidJwtError extends Error {
  public readonly jwt: string
  constructor(jwt: string) {
    super(`Invalid JWT`)
    this.jwt = jwt
  }
}

//TODO: other 2 middleware