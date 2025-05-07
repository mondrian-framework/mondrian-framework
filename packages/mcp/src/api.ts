import { assertApiValidity } from './utils'
import { decoding } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'

/**
 * The MCP API specification of a mondrian {@link module.ModuleInterface ModuleInterface}
 * This contains all information needed to generate an mcp server from a module.
 * It does not contains the implementation. In order to instantiate this you should use {@link define}.
 */
export type ApiSpecification<Fs extends functions.FunctionInterfaces> = {
  /**
   * Functions specification map.
   */
  functions: {
    [K in keyof Fs]?: FunctionSpecifications | FunctionSpecifications[]
  }
  options?: {
    /**
     * Default is /mcp
     */
    path?: string
    /**
     * Preferred decoding options that will override the module ones.
     */
    decodingOptions?: decoding.Options
  }
  /**
   * Interface of the module
   */
  module: module.ModuleInterface<Fs>
}

/**
 * The same of {@link ApiSpecification} but this contains the {@link module.Module Module} so
 * this contains also the function implementations. With an instance of {@link Api} it is possible
 * to serve the module with a rest server. In order to instantiate this you should use {@link build}.
 */
export type Api<Fs extends functions.FunctionImplementations> = ApiSpecification<Fs> & {
  /**
   * Module to serve
   */
  module: module.Module<Fs>

  /**
   * Version of the module
   */
  version?: string

  /**
   * Optional instructions describing how to use the server and its features.
   */
  instructions?: string
}

/**
 * Builds a REST API in order to expose the module.
 */
export function build<Fs extends functions.FunctionImplementations>(api: Api<Fs>): Api<Fs> {
  return { ...define(api), module: api.module }
}

/**
 * Defines the REST API with just the module interface.
 */
export function define<Fs extends functions.FunctionInterfaces>(api: ApiSpecification<Fs>): ApiSpecification<Fs> {
  assertApiValidity(api as any)
  return api
}

//TODO: add support for resources
export type FunctionSpecifications = {
  /**
   * The name of the tool.
   */
  name?: string
  /**
   * Description that can be useful to describe the tool to the LLM.
   */
  description?: string
  /**
   * Decoding options that will override the module ones.
   */
  decodingOptions?: decoding.Options
}
