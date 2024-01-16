import { decoding, model, validation } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'
import { rest } from '@mondrian-framework/rest'
import gen from 'fast-check'
import { buildSchema, GraphQLSchema, printSchema } from 'graphql'

export const OASSchema = () =>
  model.object({
    //TODO: finish model?
    openapi: model.string(),
    info: model.unknown(),
    jsonSchemaDialect: model.string().optional(),
    servers: model.array(model.unknown()).optional(),
    paths: model.unknown().optional(),
    webhooks: model.unknown().optional(),
    components: model.unknown().optional(),
    security: model.unknown().optional(),
    tags: model.unknown().optional(),
    externalDocs: model.unknown().optional(),
  })
export type OASSchema = model.Infer<typeof OASSchema>

export const GraphQLSchemaType = () =>
  model.custom<'graphql-schema', {}, GraphQLSchema>({
    typeName: 'graphql-schema',
    decoder(value) {
      if (value instanceof GraphQLSchema) {
        return decoding.succeed(value)
      }
      if (typeof value !== 'string') {
        return decoding.fail('GraphQL schema', value)
      }
      try {
        const schema = buildSchema(value)
        return decoding.succeed(schema)
      } catch (error) {
        return decoding.fail(error instanceof Error ? `GraphQL schema. (${error.message})` : 'GraphQL schema', value)
      }
    },
    encoder: (value) => printSchema(value),
    validator: () => validation.succeed(),
    arbitrary: () =>
      gen.constant(
        buildSchema(`
        type Query {
          login(username: String!, password:String!): String!
        }
        type Mutation {
          register(username: String!, password:String!): Boolean!
        }
        `),
      ),
    options: { name: 'GraphQLSchema' },
  })

export const ReportResult = () =>
  model.object({
    breakingChanges: model.integer(),
    reportId: ReporId,
    reportUrl: model.url().optional(),
    info: model.unknown(),
  })
export type ReportResult = model.Infer<typeof ReportResult>

export const ReporId = () => model.uuid()
export type ReporId = model.Infer<typeof ReporId>

export const Password = () => model.string({ minLength: 1, maxLength: 100 })
export type Password = model.Infer<typeof Password>

export const HTMLReponse = () => model.string()
export type HTMLReponse = model.Infer<typeof HTMLReponse>

export const RemoteSchema = () => model.object({ url: model.url(), headers: model.record(model.string()).optional() })
export type RemoteSchema = model.Infer<typeof RemoteSchema>

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
    previousSchema: model.union({ remote: RemoteSchema, schema: OASSchema }),
    currentSchema: model.union({ remote: RemoteSchema, schema: OASSchema }),
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
    previousSchema: model.union({ remote: RemoteSchema, schema: GraphQLSchemaType }),
    currentSchema: model.union({ remote: RemoteSchema, schema: GraphQLSchemaType }),
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
  description: `This module offers model-checking utilities designed to identify breaking changes within CI/CD pipelines. It supports the following models: OpenAPI Specification and GraphQL Schema.
We prioritize your data security. All data is encrypted, ensuring we don't have access to your schemas. For transparency, you can review our code at Mondrian-Framework repositoty under ci-tools package.

Powerd by <a href="https://pb33f.io/openapi-changes/">pb33f openapi-changes</a> <a href="https://mondrianframework.com/">Mondrian Framework</a>`,
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
  customTypeSchemas: {
    'graphql-schema': {
      type: 'string',
    },
  },
})
