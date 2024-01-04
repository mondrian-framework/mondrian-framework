import { model } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'
import { rest } from '@mondrian-framework/rest'

const OASSchema = () => model.record(model.unknown()) //TODO: model openapi schema?
const ReportResult = () =>
  model.object({
    breakingChanges: model.integer(),
    reportId: ReporId,
    reportUrl: model.url(),
  })
const ReporId = () => model.uuid()
const Password = () => model.string({ minLength: 1, maxLength: 100 })
const HTMLReponse = () => model.string()

const getReport = functions.define({
  input: model.object({
    reportId: ReporId,
    password: model.optional(Password),
  }),
  output: HTMLReponse,
  errors: { reportNotFound: ReporId },
  options: {
    namespace: 'Reports',
    description: 'Gets a report by id.\nIf the given password is incorrect or the id is wrong it will give 404.',
  },
})

const buildOASReport = functions.define({
  input: model.object({
    previousSchema: model.union({ url: model.url(), schema: OASSchema }),
    currentSchema: model.union({ url: model.url(), schema: OASSchema }),
    password: model.optional(Password),
  }),
  output: ReportResult,
  errors: { badRequest: model.string(), pb33fNotDefined: model.string() },
  options: {
    namespace: 'OpenAPI',
    description:
      'Generates a breaking changes report for two OpenAPI specifications.\nThe schemas are not stored.\nThe report is stored as **encrypted** text with the given password for 24 hours.',
  },
})

const buildGraphQLReport = functions.define({
  input: model.object({
    previousSchema: model.string(),
    currentSchema: model.string(),
    password: model.optional(Password),
  }),
  output: ReportResult,
  errors: { badRequest: model.string() },
  options: {
    namespace: 'GraphQL',
    description:
      'Generates a breaking changes report for two GraphQL schemas.\nThe schemas are not stored.\nThe report is stored as **encrypted** text with the given password for 24 hours.',
  },
})

export const moduleInterface = module.define({
  name: 'Mondrian CI-Tools',
  description: `This module provides model-checking utilities that can be used to detect breaking changes on CI/CD
Supported models: OpenAPI Specification, GraphQL Schema (Coming soon...)
We do not save any data without encryption, so we do not own your schemas. You can check the code at the Mondrian-Framework repositoty under ci-tools package.

Powerd by <a href="https://pb33f.io/openapi-changes/">pb33f openapi-changes</a> <a href="https://mondrian-framework.github.io/mondrian-framework/">Mondrian Framework</a>`,
  version: '1.0.0',
  functions: { getReport, buildOASReport, buildGraphQLReport },
})

export const restAPI = rest.define({
  module: moduleInterface,
  functions: {
    getReport: { method: 'get', path: '/reports/{reportId}', contentType: 'text/html' },
    buildOASReport: { method: 'post', path: '/reports/oas' },
    buildGraphQLReport: { method: 'post', path: '/reports/graphql' },
  },
  version: 1,
  options: { pathPrefix: '', endpoints: [process.env.SERVER_BASE_URL ?? 'http://localhost:4010'] },
  errorCodes: {
    badRequest: 400,
    reportNotFound: 404,
    pb33fNotDefined: 500,
  },
})
