import * as AWS from '@aws-sdk/client-sqs'
import { functions, module } from '@mondrian-framework/module'

/**
 * The SQS API specification of a mondrian {@link module.ModuleInterface Module Interface}
 * It does not contains the implementation. In order to instantiate this you should use {@link define}.
 */
export type ApiSpecification<Fs extends functions.FunctionInterfaces> = {
  functions: {
    [K in keyof Fs]?: FunctionSpecifications
  }
  options?: {
    config?: AWS.SQSClientConfig
    maxConcurrency?: number
  }
  module: module.ModuleInterface<Fs>
}

/**
 * The same of {@link ApiSpecification} but this contains the {@link module.Module Module} so
 * this contains also the function implementations. With an instance of {@link Api} it is possible
 * attach SQS to any functions and consuming it's messages.
 * In order to instantiate this you should use {@link build}.
 */
export type Api<Fs extends functions.FunctionImplementations> = ApiSpecification<Fs> & {
  module: module.Module<Fs>
}

export type FunctionSpecifications = {
  queueUrl: string
  malformedMessagePolicy?: 'ignore' | 'delete'
  maxConcurrency?: number
}

/**
 * Builds a SQS API in order to attach the module to the queues.
 */
export function build<Fs extends functions.FunctionImplementations>(api: Api<Fs>): Api<Fs> {
  //TODO [Good first issue]: check validity of api as rest.build
  return api
}

/**
 * Defines the SQS API with just the module interface.
 */
export function define<const Fs extends functions.FunctionInterfaces>(api: ApiSpecification<Fs>): ApiSpecification<Fs> {
  //TODO [Good first issue]: check validity of api as rest.define
  return api
}
