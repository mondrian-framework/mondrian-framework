export type Method = 'get' | 'post' | 'put' | 'delete' | 'patch'

export type Request = {
  body: unknown
  params: Record<string, string | undefined>
  query: Record<string, string | undefined>
  headers: Record<string, string | string[] | undefined>
  method: Method
  route: string
}

export type Response = {
  readonly status: number
  readonly body: unknown
  readonly headers?: Readonly<Record<string, string>>
}

export type Handler = (request: Request) => Promise<Response>
