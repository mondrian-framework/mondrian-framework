import { OpenAPIV3_1 } from 'openapi-types'
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import {
  DecodeResult,
  GenericProjection,
  LazyType,
  Types,
  convert,
  decode,
  encode,
  getProjectionType,
  getRequiredProjection,
  is,
  isVoidType,
  lazyToType,
  mergeProjections,
} from '@mondrian-framework/model'
import { assertNever, isArray } from '@mondrian-framework/utils'
import { Functions, GenericFunction, GenericModule, buildLogger, randomOperationId } from '@mondrian-framework/module'
import { decodeQueryObject } from './utils'
import { ModuleRestApi, RestFunctionSpecs } from './server'

export function attachRestMethods({
  module,
  server,
  api,
  context,
  pathPrefix,
  globalMaxVersion,
}: {
  module: GenericModule
  server: FastifyInstance
  api: ModuleRestApi<Functions>
  context: (args: { request: FastifyRequest }) => Promise<unknown>
  pathPrefix: string
  globalMaxVersion: number
}): void {
  for (const [functionName, functionBody] of Object.entries(module.functions.definitions)) {
    const specifications = api.functions[functionName]
    if (!specifications) {
      continue
    }
    for (const specification of isArray(specifications) ? specifications : [specifications]) {
      const path = `${pathPrefix}/:v${specification.path ?? `/${functionName}`}`
      if (specification.method === 'GET') {
        server.get(path, (request, reply) =>
          elabFastifyRestRequest({
            request,
            reply,
            functionName,
            module,
            api,
            specification,
            functionBody,
            context,
            globalMaxVersion,
          }),
        )
      } else if (specification.method === 'POST') {
        server.post(path, (request, reply) =>
          elabFastifyRestRequest({
            request,
            reply,
            functionName,
            module,
            api,
            specification,
            functionBody,
            context,
            globalMaxVersion,
          }),
        )
      } else if (specification.method === 'PUT') {
        server.put(path, (request, reply) =>
          elabFastifyRestRequest({
            request,
            reply,
            functionName,
            module,
            api,
            specification,
            functionBody,
            context,
            globalMaxVersion,
          }),
        )
      } else if (specification.method === 'DELETE') {
        server.delete(path, (request, reply) =>
          elabFastifyRestRequest({
            request,
            reply,
            functionName,
            module,
            api,
            specification,
            functionBody,
            context,
            globalMaxVersion,
          }),
        )
      } else if (specification.method === 'PATCH') {
        server.patch(path, (request, reply) =>
          elabFastifyRestRequest({
            request,
            reply,
            functionName,
            module,
            api,
            specification,
            functionBody,
            context,
            globalMaxVersion,
          }),
        )
      }
    }
  }
}

function firstOf2<V>(f1: () => DecodeResult<V>, f2: () => DecodeResult<V>): DecodeResult<V> {
  const v1 = f1()
  if (!v1.success) {
    const v2 = f2()
    if (v2.success) {
      return v2
    }
  }
  return v1
}

async function elabFastifyRestRequest({
  request,
  reply,
  functionName,
  module,
  specification,
  functionBody,
  context,
  globalMaxVersion,
  api,
}: {
  request: FastifyRequest
  reply: FastifyReply
  functionName: string
  module: GenericModule
  functionBody: GenericFunction
  api: ModuleRestApi<Functions>
  specification: RestFunctionSpecs
  context: (args: { request: FastifyRequest }) => Promise<unknown>
  globalMaxVersion: number
}): Promise<unknown> {
  const minVersion = specification.version?.min ?? 1
  const maxVersion = specification.version?.max ?? globalMaxVersion
  const v = (request.params as Record<string, string>).v
  const version = Number(v ? v.replace('v', '') : Number.NaN)
  if (Number.isNaN(version) || version < minVersion || version > maxVersion) {
    reply.status(404)
    return { error: 'Invalid version', minVersion: `v${minVersion}`, maxVersion: `v${maxVersion}` }
  }

  const startDate = new Date()
  const operationId = randomOperationId()
  const log = buildLogger(module.name, operationId, specification.method, functionName, 'REST', startDate)
  reply.header('operation-id', operationId)
  const inputFrom = request.method === 'GET' || request.method === 'DELETE' ? 'query' : 'body'
  const outputType = module.types[functionBody.output]
  const inputType = module.types[functionBody.input]
  const query = request.query as Record<string, unknown>
  const inputIsVoid = isVoidType(inputType)
  const input = inputIsVoid ? null : inputFrom === 'body' ? request.body : decodeQueryObject(query, 'input')
  const decoded = firstOf2(
    () => convert(inputType, input, { cast: true }),
    () => convert(inputType, query['input'], { cast: true }),
  )
  if (!decoded.success) {
    log('Bad request.')
    reply.status(400)
    return { errors: decoded.errors }
  }
  const projectionHeader = request.headers['projection']
  const projectionObject = typeof projectionHeader === 'string' ? JSON.parse(projectionHeader) : null
  const fieldType = () => getProjectionType(outputType)
  const projection =
    projectionObject != null ? decode(fieldType(), projectionObject, { cast: true, strict: true }) : undefined
  if (projection && !projection.success) {
    log('Bad request. (projection)')
    reply.status(400)
    return { errors: projection.errors, message: "On 'projection' header" }
  }
  const requiredProction =
    projection != null ? getRequiredProjection(outputType, projection.value as GenericProjection) : undefined
  const finalProjection =
    projection != null && requiredProction != null
      ? mergeProjections(projection.value as GenericProjection, requiredProction)
      : projection != null
      ? projection.value
      : undefined
  const contextInput = await context({ request })
  const ctx = await module.context(contextInput)
  try {
    const result = await functionBody.apply({
      projection: finalProjection,
      context: ctx,
      input: decoded.value,
      operationId,
      log,
    })
    const encoded = encode(outputType, result)
    log('Completed.')
    return encoded
  } catch (error) {
    log('Failed with exception.')
    if (api.errorHandler) {
      const result = await api.errorHandler({
        request,
        reply,
        error,
        log,
        functionName,
        operationId,
        context: ctx,
        functionArgs: {
          projection: finalProjection,
          input: decoded.value,
        },
      })
      if (result !== undefined) {
        return result
      }
    }
    throw error
  }
}

export function openapiSpecification({
  module,
  api,
  pathPrefix,
  version,
}: {
  module: GenericModule
  api: ModuleRestApi<Functions>
  pathPrefix: string
  version: number
}): OpenAPIV3_1.Document {
  const paths: OpenAPIV3_1.PathsObject = {}
  const components = openapiComponents({ module, version, api })
  for (const [functionName, functionBody] of Object.entries(module.functions.definitions)) {
    const specifications = api.functions[functionName]
    if (!specifications) {
      continue
    }
    for (const specification of isArray(specifications) ? specifications : [specifications]) {
      if (specification.version?.min != null && version < specification.version.min) {
        continue
      }
      if (specification.version?.max != null && version > specification.version.max) {
        continue
      }
      const path = `${specification.path ?? `/${functionName}`}`
      const inputIsVoid = isVoidType(module.types[functionBody.input])
      const operationObj: OpenAPIV3_1.OperationObject = {
        parameters: [
          ...((specification.method === 'GET' || specification.method === 'DELETE') && !inputIsVoid
            ? [
                {
                  name: 'input',
                  in: 'query',
                  required: true,
                  style: 'deepObject',
                  explode: true,
                  schema: {
                    $ref: `#/components/schemas/${functionBody.input}`,
                  },
                },
              ]
            : []),
          {
            name: 'projection',
            in: 'header',
          },
        ],
        requestBody:
          specification.method !== 'GET' && specification.method !== 'DELETE' && !inputIsVoid
            ? {
                content: {
                  'application/json': {
                    schema: {
                      $ref: `#/components/schemas/${functionBody.input}`,
                    },
                  },
                },
              }
            : undefined,
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  $ref: `#/components/schemas/${functionBody.output}`,
                },
              },
            },
          },
          '400': {
            description: 'Validation error',
          },
        },
        description: functionBody.opts?.description,
        tags: [module.name],
        security: openapiSecurityRequirements({ module, functionName }),
      }
      paths[path] = {
        summary: functionName,
        [specification.method.toLocaleLowerCase()]: operationObj,
      }
    }
  }
  return {
    openapi: '3.1.0',
    info: { version: module.version, title: module.name },
    servers: [{ url: `${pathPrefix}/v${version}` }],
    paths,
    components: { ...components, securitySchemes: openapiSecuritySchemes({ module }) },
    tags: [{ name: module.name }],
  }
}

function openapiSecurityRequirements({
  module,
  functionName,
}: {
  module: GenericModule
  functionName: string
}): OpenAPIV3_1.SecurityRequirementObject[] | undefined {
  const auth = (module.functions.options ?? {})[functionName]?.authentication
  if (auth && auth !== 'NONE') {
    return [{ [functionName]: [] }]
  } else if (auth === 'NONE') {
    return undefined
  }
  if (module.authentication) {
    return [{ _: [] }]
  }
  return undefined
}

function openapiSecuritySchemes({
  module,
}: {
  module: GenericModule
}): Record<string, OpenAPIV3_1.SecuritySchemeObject> | undefined {
  const defaultSchema: OpenAPIV3_1.SecuritySchemeObject | undefined = module.authentication
    ? { type: 'http', scheme: module.authentication.type, bearerFormat: module.authentication.format }
    : undefined
  const schemas = Object.fromEntries(
    Object.entries(module.functions.options ?? {}).flatMap(([k, v]) => {
      if (!v?.authentication || v.authentication === 'NONE') {
        return []
      }
      const schema: OpenAPIV3_1.SecuritySchemeObject = {
        type: 'http',
        scheme: v.authentication.type,
        bearerFormat: v.authentication.format,
      }
      return [[k, schema]]
    }),
  )
  if (Object.keys(schemas).length === 0 && !defaultSchema) {
    return undefined
  }
  return {
    ...schemas,
    ...(defaultSchema ? { _: defaultSchema } : {}),
  }
}

function openapiComponents({
  module,
  version,
  api,
}: {
  module: GenericModule
  version: number
  api: ModuleRestApi<Functions>
}): OpenAPIV3_1.ComponentsObject {
  const usedTypes: string[] = []
  for (const [functionName, functionBody] of Object.entries(module.functions.definitions)) {
    const specifications = api.functions[functionName]
    if (!specifications) {
      continue
    }
    for (const specification of isArray(specifications) ? specifications : [specifications]) {
      if (specification.version?.min != null && version < specification.version.min) {
        continue
      }
      if (specification.version?.max != null && version > specification.version.max) {
        continue
      }
      usedTypes.push(functionBody.input)
      usedTypes.push(functionBody.output)
    }
  }
  const schemas: Record<string, OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.SchemaObject> = {}
  const typeMap: Record<string, OpenAPIV3_1.SchemaObject> = {}
  const typeRef: Map<Function, string> = new Map()
  for (const [name, type] of Object.entries(module.types).filter(([k, t]) => usedTypes.includes(k) && !isVoidType(t))) {
    const result = typeToSchemaObject(name, type, module.types, typeMap, typeRef)
    schemas[name] = result
  }
  for (const [name, type] of Object.entries(typeMap)) {
    schemas[name] = type
  }
  return { schemas }
}

function typeToSchemaObject(
  name: string,
  t: LazyType,
  types: Types,
  typeMap: Record<string, OpenAPIV3_1.SchemaObject>, //type name -> definition
  typeRef: Map<Function, string>, // function -> type name
): OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.SchemaObject {
  for (const [n, type] of Object.entries(types)) {
    if (type === t) {
      name = n
    }
  }
  if (typeof t === 'function') {
    const n = typeRef.get(t)
    if (n) {
      return { $ref: `#/components/schemas/${n}` }
    }
    typeRef.set(t, name)
  }
  const type = typeToSchemaObjectInternal(name, t, types, typeMap, typeRef)
  if (typeof t === 'function' || name in types) {
    typeMap[name] = type
    if ('anyOf' in type && type.anyOf?.some((v) => '$ref' in v && v.$ref === `#/components/schemas/${name}`)) {
      return type
    }
    return { $ref: `#/components/schemas/${name}` }
  }
  return type
}
function typeToSchemaObjectInternal(
  name: string,
  t: LazyType,
  types: Types,
  typeMap: Record<string, OpenAPIV3_1.SchemaObject>, //type name -> definition
  typeRef: Map<Function, string>, // function -> type name
): OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.SchemaObject {
  const type = lazyToType(t)
  if (type.kind === 'string') {
    return {
      type: 'string',
      pattern: type.opts?.regex?.source,
      minLength: type.opts?.minLength,
      maxLength: type.opts?.maxLength,
    }
  }
  if (type.kind === 'custom') {
    if (type.name === 'timestamp') {
      return { type: 'integer', description: type.opts?.description }
    }
    if (type.name === 'datetime') {
      return { type: 'string', format: 'date-time', description: type.opts?.description }
    }
    if (type.name === 'email') {
      return { type: 'string', format: 'email', description: type.opts?.description }
    }
    return { type: 'string', description: type.opts?.description ?? type.name }
  }
  if (type.kind === 'boolean') {
    return { type: 'boolean' }
  }
  if (type.kind === 'number') {
    return {
      type: type.opts?.multipleOf != null && type.opts.multipleOf % 1 === 0 ? 'integer' : 'number',
      maximum: type.opts?.maximum,
      minimum: type.opts?.minimum,
      exclusiveMaximum: type.opts?.exclusiveMaximum,
      exclusiveMinimum: type.opts?.exclusiveMinimum,
      description: type.opts?.description,
      multipleOf: type.opts?.multipleOf === 1 ? undefined : type.opts?.multipleOf,
    }
  }
  if (type.kind === 'literal') {
    const t = typeof type.value
    const tp = t === 'boolean' ? t : t === 'number' ? t : t === 'string' ? t : null
    if (type.value === null) {
      return { type: 'null', const: 'null' }
    }
    if (tp === null) {
      throw new Error(`Unknown literal type: ${tp}`)
    }
    return { type: tp, const: type.value, example: type.value, description: type.opts?.description }
  }
  if (type.kind === 'array-decorator') {
    const items = typeToSchemaObject(name, type.type, types, typeMap, typeRef)
    return { type: 'array', items }
  }
  if (type.kind === 'optional-decorator') {
    const subtype = typeToSchemaObject(name, type.type, types, typeMap, typeRef)
    return { anyOf: [subtype, { type: 'null', description: 'optional' }] }
  }
  if (type.kind === 'default-decorator') {
    const subtype = typeToSchemaObject(name, type.type, types, typeMap, typeRef)
    return {
      anyOf: [
        { ...subtype, example: type.opts.default },
        { type: 'null', description: 'optional' },
      ],
    }
  }
  if (type.kind === 'nullable-decorator') {
    const subtype = typeToSchemaObject(name, type.type, types, typeMap, typeRef)
    return { anyOf: [subtype, { const: null }] }
  }
  if (type.kind === 'relation-decorator') {
    const subtype = typeToSchemaObject(name, type.type, types, typeMap, typeRef)
    return subtype
  }
  if (type.kind === 'object') {
    const fields = Object.entries(type.type).map(([fieldName, fieldT]) => {
      const fieldType = typeToSchemaObject(`${name}_${fieldName}`, fieldT, types, typeMap, typeRef)
      return [fieldName, fieldType] as const
    })
    const isOptional: (
      type: OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.SchemaObject,
    ) => { optional: true; subtype: OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.SchemaObject } | false = (type) =>
      'anyOf' in type && type.anyOf && type.anyOf.length === 2 && type.anyOf[1].description === 'optional'
        ? { optional: true, subtype: type.anyOf[0] }
        : false
    const object: OpenAPIV3_1.SchemaObject = {
      type: 'object',
      required: fields.filter(([name, type]) => isOptional(type) === false).map((v) => v[0]),
      properties: Object.fromEntries(
        fields.map(([name, type]) => {
          const isOpt = isOptional(type)
          if (isOpt !== false) {
            return [name, isOpt.subtype]
          }
          return [name, type]
        }),
      ),
      description: type.opts?.description,
    }
    return object
  }
  if (type.kind === 'enum') {
    return { type: 'string', enum: type.values as unknown as string[], description: type.opts?.description } as const
  }
  if (type.kind === 'union-operator') {
    const uniontypes = Object.entries(type.types).map(([k, t]) =>
      typeToSchemaObject(`${name}_${k}`, t, types, typeMap, typeRef),
    )
    return { anyOf: uniontypes, description: type.opts?.description }
  }
  return assertNever(type)
}
