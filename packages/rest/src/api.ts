import { Functions } from '@mondrian-framework/module'

export type RestMethod = 'get' | 'post' | 'put' | 'delete' | 'patch'

export type RestFunctionSpecs = {
  method: RestMethod
  path?: string
  version?: { min?: number; max?: number }
}

export type RestApi<F extends Functions> = {
  functions: {
    [K in keyof F]?: RestFunctionSpecs | readonly RestFunctionSpecs[]
  }
  options?: {
    introspection?: boolean
    /**
     * Default is /api
     */
    pathPrefix?: string
  }
  version?: number
}
