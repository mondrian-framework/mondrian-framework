import { OpenAPIV3_1 } from 'openapi-types'
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { DecodeResult, LazyType, Types, decode, encode, isVoidType, lazyToType } from '@mondrian/model'
import { assertNever } from '@mondrian/utils'
import {
  Functions,
  GenericFunction,
  GenericModule,
  getProjectionType,
  buildLogger,
  randomOperationId,
} from '@mondrian/module'
import { decodeQueryObject } from './utils'
import { ModuleRestApi, RestFunctionSpecs } from './server'

export function attachRestMethods({
  module,
  server,
  api,
  context,
}: {
  module: GenericModule
  server: FastifyInstance
  api: ModuleRestApi<Functions>
  context: (args: { request: FastifyRequest }) => Promise<unknown>
}): void {
  for (const [functionName, functionBody] of Object.entries(module.functions)) {
    const specifications = api.functions[functionName]
    if (!specifications) {
      continue
    }
    const path = `/api${specifications.path ?? `/${functionName}`}`
    if (specifications.method === 'GET') {
      server.get(path, (request, reply) =>
        elabFastifyRestRequest({ request, reply, functionName, module, api, specifications, functionBody, context }),
      )
    } else if (specifications.method === 'POST') {
      server.post(path, (request, reply) =>
        elabFastifyRestRequest({ request, reply, functionName, module, api, specifications, functionBody, context }),
      )
    } else if (specifications.method === 'PUT') {
      server.put(path, (request, reply) =>
        elabFastifyRestRequest({ request, reply, functionName, module, api, specifications, functionBody, context }),
      )
    } else if (specifications.method === 'DELETE') {
      server.delete(path, (request, reply) =>
        elabFastifyRestRequest({ request, reply, functionName, module, api, specifications, functionBody, context }),
      )
    } else if (specifications.method === 'PATCH') {
      server.patch(path, (request, reply) =>
        elabFastifyRestRequest({ request, reply, functionName, module, api, specifications, functionBody, context }),
      )
    }
  }
}

function firstOf2<V>(f1: () => DecodeResult<V>, f2: () => DecodeResult<V>): DecodeResult<V> {
  const v1 = f1()
  if (!v1.pass) {
    const v2 = f2()
    if (v2.pass) {
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
  specifications,
  functionBody,
  context,
}: {
  request: FastifyRequest
  reply: FastifyReply
  functionName: string
  module: GenericModule
  functionBody: GenericFunction
  api: ModuleRestApi<Functions>
  specifications: RestFunctionSpecs
  context: (args: { request: FastifyRequest }) => Promise<unknown>
}): Promise<unknown> {
  const startDate = new Date()
  const operationId = randomOperationId()
  const log = buildLogger(module.name, operationId, specifications.method, functionName, 'REST', startDate)
  reply.header('operation-id', operationId)
  const inputFrom = request.method === 'GET' || request.method === 'DELETE' ? 'query' : 'body'
  const outputType = module.types[functionBody.output]
  const inputType = module.types[functionBody.input]
  const query = request.query as Record<string, unknown>
  const inputIsVoid = isVoidType(inputType)
  const input = inputIsVoid ? null : inputFrom === 'body' ? request.body : decodeQueryObject(query, 'input')
  const decoded = firstOf2(
    () => decode(inputType, input, { cast: inputFrom !== 'body' }),
    () => decode(inputType, query['input'], { cast: inputFrom !== 'body' }),
  )
  if (!decoded.pass) {
    log('Bad request.')
    reply.status(400)
    return { errors: decoded.errors }
  }
  const fieldsHeader = request.headers['fields']
  const fieldsObject = typeof fieldsHeader === 'string' ? JSON.parse(fieldsHeader) : null
  const fieldType = () => getProjectionType(outputType)
  //TODO: merge (decoded)fieldsObject extractRequiredFields(outputType)
  const fields = fieldsObject != null ? decode(fieldType(), fieldsObject, { cast: true }) : undefined
  if (fields && !fields.pass) {
    log('Bad request. (fields)')
    reply.status(400)
    return { errors: fields.errors, message: "On 'fields' header" }
  }
  const contextInput = await context({ request })
  const ctx = await module.context(contextInput)
  try {
    const result = await functionBody.apply({
      fields: fields ? (fields.value as any) : undefined,
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
    throw error
  }
}

export function openapiSpecification({
  module,
  api,
}: {
  module: GenericModule
  api: ModuleRestApi<Functions>
}): OpenAPIV3_1.Document {
  const paths: OpenAPIV3_1.PathsObject = {}
  const components = openapiComponents({ module })
  for (const [functionName, functionBody] of Object.entries(module.functions)) {
    const specifications = api.functions[functionName]
    if (!specifications) {
      continue
    }
    const path = `${specifications.path ?? `/${functionName}`}`
    const inputIsVoid = isVoidType(module.types[functionBody.input])
    const operationObj: OpenAPIV3_1.OperationObject = {
      parameters: [
        ...((specifications.method === 'GET' || specifications.method === 'DELETE') && !inputIsVoid
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
          name: 'fields',
          in: 'header',
        },
      ],
      requestBody:
        specifications.method !== 'GET' && specifications.method !== 'DELETE' && !inputIsVoid
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
    }
    paths[path] = {
      summary: functionName,
      [specifications.method.toLocaleLowerCase()]: operationObj,
    }
  }
  return {
    openapi: '3.1.0',
    info: {
      version: '1.0.0', //TODO
      title: module.name,
      license: { name: 'MIT' }, //TODO
    },
    servers: [{ url: `http://127.0.0.1:4000/api` }], //TODO
    paths,
    components,
    tags: [{ name: module.name }],
  }
}

function openapiComponents({ module }: { module: GenericModule }): OpenAPIV3_1.ComponentsObject {
  const schemas: Record<string, OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.SchemaObject> = {}
  const typeMap: Record<string, OpenAPIV3_1.SchemaObject> = {}
  const typeRef: Map<Function, string> = new Map()
  for (const [name, type] of Object.entries(module.types).filter((v) => !isVoidType(v[1]))) {
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
      format: type.opts?.format,
    }
  }
  if (type.kind === 'custom') {
    if (type.name === 'timestamp') {
      return { type: 'integer', description: type.opts?.description }
    }
    if (type.name === 'datetime') {
      return { type: 'string', format: 'date-time', description: type.opts?.description }
    }
    return { type: 'string', description: type.opts?.description ?? type.name }
  }
  if (type.kind === 'boolean') {
    return { type: 'boolean' }
  }
  if (type.kind === 'number') {
    //TODO: integer
    return {
      type: 'number',
      maximum: type.opts?.maximum,
      minimum: type.opts?.minimum,
      exclusiveMaximum: type.opts?.exclusiveMaximum,
      exclusiveMinimum: type.opts?.exclusiveMinimum,
      description: type.opts?.description,
    }
  }
  if (type.kind === 'literal') {
    const t = typeof type.value
    //TODO: integer
    const tp = t === 'boolean' ? t : t === 'number' ? t : t === 'string' ? t : null
    if (type.value === null) {
      return { type: 'null' }
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
  if (type.kind === 'optional-decorator' || type.kind === 'default-decorator') {
    const subtype = typeToSchemaObject(name, type.type, types, typeMap, typeRef)
    return { allOf: [subtype, { type: 'null', description: 'optional' }] }
  }
  if (type.kind === 'hide-decorator') {
    const subtype = typeToSchemaObject(name, type.type, types, typeMap, typeRef)
    return { allOf: [subtype, { type: 'null', description: 'optional' }] }
  }
  if (type.kind === 'object') {
    const fields = Object.entries(type.type).map(([fieldName, fieldT]) => {
      const fieldType = typeToSchemaObject(`${name}_${fieldName}`, fieldT, types, typeMap, typeRef)
      return [fieldName, fieldType] as const
    })
    const isOptional: (
      type: OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.SchemaObject,
    ) => { optional: true; subtype: OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.SchemaObject } | false = (type) =>
      'allOf' in type && type.allOf && type.allOf.length === 2 && type.allOf[1].description === 'optional'
        ? { optional: true, subtype: type.allOf[0] }
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
  if (type.kind === 'enumerator') {
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
