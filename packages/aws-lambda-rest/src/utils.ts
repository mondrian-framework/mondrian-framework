import { Request, Response } from 'lambda-api'

export type ServerContext = { lambdaApi: { request: Request; response: Response } }
