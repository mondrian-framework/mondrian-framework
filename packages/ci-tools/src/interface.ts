import { model } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'
import { rest } from '@mondrian-framework/rest'

const getReport = functions.define({
  input: model.object({
    reportId: model.string({ maxLength: 36 }),
    password: model.string({ minLength: 1, maxLength: 100 }).optional(),
  }),
  output: model.string(),
  errors: { reportNotFound: model.string() },
  options: {
    description: 'Gets a report by id.\nIf the given password is incorrect or the id is wrong it will give 404.',
  },
})

const buildReport = functions.define({
  input: model.object({
    type: model.literal('oas'),
    previousSchema: model.unknown(), //TODO: model openapi schema?
    currentSchema: model.unknown(),
    password: model.string({ minLength: 1, maxLength: 100 }).optional(),
  }),
  output: model.object({
    breakingChanges: model.integer(),
    reportId: model.string({ maxLength: 36 }),
    reportUrl: model.string(),
  }),
  errors: { badRequest: model.string(), pb33fNotDefined: model.string() },
  options: {
    description:
      'Generates a breaking changes report for either OpenAPI or GraphQL specs.\nThe schemas are not stored.\nThe report is stored as **encrypted** text with the given password for 24 hours.\n\nGraphQL coming soon...',
  },
})

export const moduleInterface = module.define({
  name: 'CI-Tools',
  description:
    'This module provides model-checking utilities that can be used to detect breaking changes on CI/CD\nSupported models: OpenAPI Specification, GraphQL Schema (Coming soon...)\n\nPowerd by <a href="https://pb33f.io/openapi-changes/">pb33f openapi-changes</a> <a href="https://mondrian-framework.github.io/mondrian-framework/">Mondrian Framework</a>',
  version: '1.0.0',
  functions: { getReport, buildReport },
})

export const restAPI = rest.define({
  module: moduleInterface,
  functions: {
    getReport: { method: 'get', path: '/reports/{reportId}', contentType: 'text/html' },
    buildReport: { method: 'post', path: '/reports' },
  },
  version: 1,
  options: { pathPrefix: '', endpoints: [process.env.SERVER_BASE_URL ?? 'http://localhost:4010'] },
  errorCodes: {
    badRequest: 400,
    reportNotFound: 404,
    pb33fNotDefined: 500,
  },
})
