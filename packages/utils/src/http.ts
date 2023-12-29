//An abstraction of http Request, Response and request Handler

export type Method = 'get' | 'post' | 'put' | 'delete' | 'patch'

export type Request<Body = unknown> = {
  body: Body
  params: Record<string, string | undefined>
  query: Record<string, string | undefined>
  headers: Record<string, string | string[] | undefined>
  method: Method
  route: string
}

export type Response<Body = unknown> = {
  readonly status: number
  readonly body: Body
  readonly headers?: Readonly<Record<string, string>>
}

export type Handler<ServerContext = unknown, RequestBody = unknown, ResponseBody = unknown> = (args: {
  request: Request<RequestBody>
  serverContext: ServerContext
}) => Promise<Response<ResponseBody>>
