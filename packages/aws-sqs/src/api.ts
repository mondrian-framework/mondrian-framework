import * as AWS from '@aws-sdk/client-sqs'
import { functions, module } from '@mondrian-framework/module'

export type ApiSpecifications<Fs extends functions.Functions> = {
  functions: {
    [K in keyof Fs]?: FunctionSpecifications
  }
  options?: {
    config?: AWS.SQSClientConfig
    maxConcurrency?: number
  }
}

export type Api<Fs extends functions.Functions, CI> = {
  module: module.Module<Fs, CI>
  functions: {
    [K in keyof Fs]?: FunctionSpecifications
  }
  options?: {
    config?: AWS.SQSClientConfig
    maxConcurrency?: number
  }
}

export type FunctionSpecifications = {
  queueUrl: string
  malformedMessagePolicy?: 'ignore' | 'delete'
  maxConcurrency?: number
}

/**
 * TODO: doc
 */
export function build<const Fs extends functions.Functions, CI>(api: Api<Fs, CI>): Api<Fs, CI> {
  //TODO [Good first issue]: check validity of api as rest.build
  return api
}
