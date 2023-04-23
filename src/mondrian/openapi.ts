import { OpenAPIV3_1 } from 'openapi-types'
import { Module, ModuleRunnerOptions, OperationNature, Operations } from './mondrian'
import { LazyType, Types } from './type-system'
import { assertNever, lazyToType } from './utils'

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
      return { $ref: `#/components/schemas/${name}` }
    }
    typeRef.set(t, name)
  }

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
    return { type: 'number' }
  }
  if (type.kind === 'array-decorator') {
    const subtype = typeToSchemaObject(name, type.type, types, typeMap, typeRef)
    return { type: 'array', items: subtype }
  }
  if (type.kind === 'optional-decorator') {
    return {
      allOf: [typeToSchemaObject(name, type.type, types, typeMap, typeRef), { type: 'null', description: 'optional' }],
    }
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
    typeMap[name] = object
    if (name in types) {
      return { $ref: `#/components/schemas/${name}` }
    }
    return object
  }
  if (type.kind === 'enumarator') {
    return { type: 'string', enum: type.values as unknown as string[] }
  }
  if (type.kind === 'union-operator') {
    const uniontypes = type.types.map((t, i) => typeToSchemaObject(`${name}_Union_${i}`, t, types, typeMap, typeRef))
    return { anyOf: uniontypes }
  }
  if (type.kind === 'null') {
    return { type: 'null' }
  }
  return assertNever(type)
}

function openapiComponents<const T extends Types, const O extends Operations<T>, const Context>({
  module,
  options,
}: {
  module: Module<T, O, Context>
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

export function openapiSpecification<const T extends Types, const O extends Operations<T>, const Context>({
  module,
  options,
}: {
  module: Module<T, O, Context>
  options: ModuleRunnerOptions
}): OpenAPIV3_1.Document {
  const paths: OpenAPIV3_1.PathsObject = {}
  const components = openapiComponents({ module, options })
  for (const [opt, operations] of Object.entries(module.operations)) {
    const operationNature = opt as OperationNature
    for (const [operationName, operation] of Object.entries(operations)) {
      const path = `${operation.options?.rest?.path ?? `/${operationName}`}`
      const method = operation.options?.rest?.method ?? (operationNature === 'queries' ? 'get' : 'post')
      const operationObj: OpenAPIV3_1.OperationObject = {
        parameters:
          method === 'get'
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
            : undefined,
        requestBody:
          method !== 'get'
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
      }
      paths[path] = {
        summary: operationName,
        [method]: operationObj,
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
    servers: [{ url: 'http://127.0.0.1:4000/api' }], //TODO
    paths,
    components,
  }
}
