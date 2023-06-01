import { RestApi } from './api'
import { LazyType, Types, isVoidType, lazyToType } from '@mondrian-framework/model'
import { Functions, GenericModule } from '@mondrian-framework/module'
import { assertNever, isArray } from '@mondrian-framework/utils'
import { OpenAPIV3_1 } from 'openapi-types'

export function generateOpenapiDocument({
  module,
  api,
  version,
}: {
  module: GenericModule
  api: RestApi<Functions>
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
          ...((specification.method === 'get' || specification.method === 'delete') && !inputIsVoid
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
          specification.method !== 'get' && specification.method !== 'delete' && !inputIsVoid
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
    servers: [{ url: `${`/${module.name.toLocaleLowerCase()}${api.options?.pathPrefix ?? '/api'}`}/v${version}` }],
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
  api: RestApi<Functions>
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
    if (type.name === 'void') {
      return { type: 'null', const: 'null', description: 'void' }
    }
    const t = typeToSchemaObject(type.name, type.encodedType, types, typeMap, typeRef)
    return { ...t, description: type.opts?.description ?? type.name, format: type.format }
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
