import { OpenAPIV3_1 } from 'openapi-types'
import { GenericModule, ModuleRunnerOptions, OperationNature } from './mondrian'
import { LazyType, Types } from './type-system'
import { assertNever, decodeQueryObject, lazyToType } from './utils'
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { randomUUID } from 'crypto'
import { decode } from './decoder'
import { encode } from './encoder'
import { getProjectionType } from './projection'

export function attachRestMethods({
  module,
  options,
  server,
}: {
  module: GenericModule
  options: ModuleRunnerOptions
  server: FastifyInstance
}): void {
  for (const [opt, operations] of Object.entries(module.operations)) {
    const operationNature = opt as OperationNature
    for (const [operationName, operation] of Object.entries(operations)) {
      const path = `${options.http?.prefix}${operation.options?.rest?.path ?? `/${operationName}`}`
      const method = operation.options?.rest?.method ?? (operationNature === 'queries' ? 'GET' : 'POST')
      if (method === 'GET') {
        server.get(path, (request, reply) =>
          elabFastifyRestRequest({ request, reply, operationName, operationNature, module, options }),
        )
      } else if (method === 'POST') {
        server.post(path, (request, reply) =>
          elabFastifyRestRequest({ request, reply, operationName, operationNature, module, options }),
        )
      } else if (method === 'PUT') {
        server.put(path, (request, reply) =>
          elabFastifyRestRequest({ request, reply, operationName, operationNature, module, options }),
        )
      } else if (method === 'DELETE') {
        server.delete(path, (request, reply) =>
          elabFastifyRestRequest({ request, reply, operationName, operationNature, module, options }),
        )
      } else if (method === 'PATCH') {
        server.patch(path, (request, reply) =>
          elabFastifyRestRequest({ request, reply, operationName, operationNature, module, options }),
        )
      }
    }
  }
}

async function elabFastifyRestRequest({
  request,
  reply,
  operationName,
  module,
  operationNature,
  options,
}: {
  request: FastifyRequest
  reply: FastifyReply
  operationName: string
  operationNature: OperationNature
  module: GenericModule
  options: ModuleRunnerOptions
}): Promise<unknown> {
  const operationId = randomUUID().split('-').join('')
  reply.header('operation-id', operationId)
  const operation = module.operations[operationNature][operationName]
  const resolver = module.resolvers[operationNature][operationName]
  const inputFrom = request.method === 'GET' || request.method === 'DELETE' ? 'query' : 'body'
  const input =
    inputFrom === 'body' ? request.body : decodeQueryObject(request.query as Record<string, unknown>, 'input')
  const decoded = decode(operation.types[operation.input], input, { cast: inputFrom !== 'body' })
  if (!decoded.pass) {
    if (options.http?.logger) {
      console.log(`[REST-MODULE / ${operationNature}.${operationName}]: Bad request. ID: ${operationId}`)
    }
    reply.status(400)
    return { errors: decoded.errors }
  }
  const fieldsHeader = request.headers['fields']
  const fieldsObject = typeof fieldsHeader === 'string' ? JSON.parse(fieldsHeader) : null
  const fieldType = () => getProjectionType(operation.types[operation.output])
  const fields = fieldsObject != null ? decode(fieldType(), fieldsObject, { cast: true }) : undefined
  if (fields && !fields.pass) {
    if (options.http?.logger) {
      console.log(`[REST-MODULE / ${operationNature}.${operationName}]: Bad request (fields). ID: ${operationId}`)
    }
    reply.status(400)
    return { errors: fields.errors, message: "On 'fields' header" }
  }
  const startMs = new Date().getTime()
  const context = await module.context({ headers: request.headers })
  const result = await resolver.f({
    fields: fields ? (fields.value as any) : undefined,
    context,
    input: decoded.value,
  })
  const encoded = encode(operation.types[operation.output], result)
  if (options.http?.logger) {
    console.log(
      `[REST-MODULE / ${operationNature}.${operationName}]: ${request.method} ${request.routerPath} Completed in ${
        new Date().getTime() - startMs
      } ms. ID: ${operationId}`,
    )
  }
  return encoded
}

export function openapiSpecification({
  module,
  options,
}: {
  module: GenericModule
  options: ModuleRunnerOptions
}): OpenAPIV3_1.Document {
  const paths: OpenAPIV3_1.PathsObject = {}
  const components = openapiComponents({ module, options })
  for (const [opt, operations] of Object.entries(module.operations)) {
    const operationNature = opt as OperationNature
    for (const [operationName, operation] of Object.entries(operations)) {
      const path = `${operation.options?.rest?.path ?? `/${operationName}`}`
      const method = operation.options?.rest?.method ?? (operationNature === 'queries' ? 'GET' : 'POST')
      const operationObj: OpenAPIV3_1.OperationObject = {
        parameters: [
          ...(method === 'GET' || method === 'DELETE'
            ? [
                {
                  name: 'input',
                  in: 'query',
                  required: true,
                  style: 'deepObject',
                  explode: true,
                  schema: {
                    $ref: `#/components/schemas/${operation.input}`,
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
          method !== 'GET' && method !== 'DELETE'
            ? {
                content: {
                  'application/json': {
                    schema: {
                      $ref: `#/components/schemas/${operation.input}`,
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
                  $ref: `#/components/schemas/${operation.output}`,
                },
              },
            },
          },
          '400': {
            description: 'Validation error',
          },
        },
        tags: [module.name],
      }
      paths[path] = {
        summary: operationName,
        [method.toLocaleLowerCase()]: operationObj,
      }
    }
  }
  return {
    openapi: '3.1.0',
    info: {
      version: '1.0.0', //TODO
      title: module.name,
      license: { name: 'MIT' }, //TODO
    },
    servers: [{ url: `http://127.0.0.1:4000${options.http?.prefix ?? '/api'}` }], //TODO
    paths,
    components,
    tags: [{ name: module.name }],
  }
}

function openapiComponents({
  module,
  options,
}: {
  module: GenericModule
  options: ModuleRunnerOptions
}): OpenAPIV3_1.ComponentsObject {
  const schemas: Record<string, OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.SchemaObject> = {}
  const typeMap: Record<string, OpenAPIV3_1.SchemaObject> = {}
  const typeRef: Map<Function, string> = new Map()
  for (const [name, type] of Object.entries(module.types)) {
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
      return { type: 'integer' }
    }
    if (type.name === 'datetime') {
      return { type: 'string', format: 'date-time' }
    }
    return { type: 'string', description: type.name }
  }
  if (type.kind === 'boolean') {
    return { type: 'boolean' }
  }
  if (type.kind === 'number') {
    //TODO: Float
    return {
      type: 'number',
      maximum: type.opts?.maximum,
      minimum: type.opts?.minimum,
      exclusiveMaximum: type.opts?.exclusiveMaximum,
      exclusiveMinimum: type.opts?.exclusiveMinimum,
    }
  }
  if (type.kind === 'array-decorator') {
    const items = typeToSchemaObject(name, type.type, types, typeMap, typeRef)
    return { type: 'array', items }
  }
  if (type.kind === 'optional-decorator' || type.kind === 'default-decorator') {
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
    }
    return object
  }
  if (type.kind === 'enumerator') {
    return { type: 'string', enum: type.values as unknown as string[] } as const
  }
  if (type.kind === 'union-operator') {
    const uniontypes = Object.entries(type.types).map(([k, t]) => typeToSchemaObject(k, t, types, typeMap, typeRef))
    return { anyOf: uniontypes }
  }
  if (type.kind === 'null') {
    return { type: 'null' }
  }
  return assertNever(type)
}
