import { RestApi, RestFunctionSpecs, RestMethod, RestRequest } from './api'
import { decodeQueryObject } from './utils'
import {
  LazyType,
  ObjectType,
  Types,
  getFirstConcreteType,
  getProjectionType,
  hasDecorator,
  encodedTypeIsScalar,
  isVoidType,
  lazyToType,
  object,
} from '@mondrian-framework/model'
import { Functions, GenericFunction, GenericModule } from '@mondrian-framework/module'
import { assertNever, isArray } from '@mondrian-framework/utils'
import { OpenAPIV3_1 } from 'openapi-types'

function isInputRequired(type: LazyType): boolean {
  return (
    !hasDecorator(type, 'nullable-decorator') &&
    !hasDecorator(type, 'optional-decorator') &&
    !hasDecorator(type, 'default-decorator')
  )
}
function generatePathParameters({
  parameters,
  type,
  module,
  typeMap,
  typeRef,
}: {
  parameters: string[]
  type: ObjectType
  module: GenericModule
  typeMap: Record<string, OpenAPIV3_1.SchemaObject>
  typeRef: Map<Function, string>
}): OpenAPIV3_1.ParameterObject[] {
  const result: OpenAPIV3_1.ParameterObject[] = []
  for (const parameter of parameters) {
    const subtype = type.type[parameter]
    const schema = typeToSchemaObject(parameter, subtype, module.types, typeMap, typeRef, true)
    result.push({ in: 'path', name: parameter, required: true, schema: schema as any })
  }
  return result
}

export function getInputExtractor(args: {
  specification: RestFunctionSpecs
  functionBody: GenericFunction
  module: GenericModule
}): (request: RestRequest) => unknown {
  return generateOpenapiInput({ ...args, typeMap: {}, typeRef: new Map() }).input
}

function generateOpenapiInput({
  specification,
  functionBody,
  typeMap,
  typeRef,
  module,
}: {
  specification: RestFunctionSpecs
  functionBody: GenericFunction
  typeMap: Record<string, OpenAPIV3_1.SchemaObject>
  typeRef: Map<Function, string>
  module: GenericModule
}): {
  parameters?: (OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.ParameterObject)[]
  requestBody?: OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.RequestBodyObject
  input: (request: RestRequest) => unknown
} {
  if (specification.openapi) {
    return {
      parameters:
        specification.openapi.specification.parameters === null
          ? undefined
          : specification.openapi.specification.parameters,
      requestBody:
        specification.openapi.specification.requestBody === null
          ? undefined
          : specification.openapi.specification.requestBody,
      input: specification.openapi.input,
    }
  }
  const parametersInPath = specification.path
    ? [...(specification.path.match(/{(.*?)}/g) ?? [])].map((v) => v.replace('{', '').replace('}', '')).filter((v) => v)
    : []
  const inputType = module.types[functionBody.input]
  const isScalar = encodedTypeIsScalar(inputType)
  const isArray = hasDecorator(inputType, 'array-decorator')
  const isRequired = isInputRequired(inputType)
  if (isVoidType(inputType)) {
    return { input: () => undefined }
  }
  const t = getFirstConcreteType(inputType)
  if (t.kind === 'object') {
    for (const p of parametersInPath) {
      if (!t.type[p] || !encodedTypeIsScalar(t.type[p])) {
        throw new Error(
          `Error while generating openapi input type ${functionBody.input}. Path parameter ${p} can only be scalar type. Path ${specification.path}`,
        )
      }
    }
  }
  if (isArray && parametersInPath.length > 0) {
    throw new Error(
      `Error while generating openapi input type ${functionBody.input}. Path parameter with array are not supported. Path ${specification.path}`,
    )
  }
  if (isScalar && parametersInPath.length > 1) {
    throw new Error(
      `Error while generating openapi input type ${functionBody.input}. Only one parameter is needed. Path ${specification.path}`,
    )
  }
  if (isScalar && parametersInPath.length === 1) {
    const schema = typeToSchemaObject(parametersInPath[0], inputType, module.types, typeMap, typeRef, true)
    return {
      parameters: [{ in: 'path', name: parametersInPath[0], schema: schema as any, required: true }],
      input: (request) => {
        return request.params[parametersInPath[0]]
      },
    }
  }
  if (specification.method === 'get' || specification.method === 'delete') {
    if (parametersInPath.length === 0) {
      const schema = typeToSchemaObject(
        specification.inputName ?? 'input',
        inputType,
        module.types,
        typeMap,
        typeRef,
        true,
      )
      return {
        parameters: [
          {
            name: specification.inputName ?? 'input',
            in: 'query',
            required: isScalar ? isRequired : true,
            style: isScalar ? undefined : 'deepObject',
            explode: true,
            schema: isScalar
              ? (schema as any)
              : {
                  $ref: `#/components/schemas/${functionBody.input}`,
                },
          },
        ],
        input: (request: RestRequest) => decodeQueryObject(request.query, specification.inputName ?? 'input'),
      }
    }
    if (t.kind === 'object') {
      const parameters = generatePathParameters({ parameters: parametersInPath, module, type: t, typeMap, typeRef })
      for (const [key, subtype] of Object.entries(t.type).filter((v) => !parametersInPath.includes(v[0]))) {
        const schema = typeToSchemaObject(key, subtype, module.types, typeMap, typeRef, true)
        parameters.push({
          name: key,
          in: 'query',
          required: isInputRequired(subtype),
          style: encodedTypeIsScalar(subtype) ? undefined : 'deepObject',
          explode: true,
          schema: schema as any,
        })
      }
      return {
        parameters,
        input: (request) => {
          const object: Record<string, unknown> = Object.fromEntries(
            parametersInPath.map((p) => [p, request.params[p]]),
          )
          for (const [key, subtype] of Object.entries(t.type).filter((v) => !parametersInPath.includes(v[0]))) {
            if (encodedTypeIsScalar(subtype)) {
              object[key] = request.query[key]
            } else {
              object[key] = decodeQueryObject(request.query, key)
            }
          }
          return object
        },
      }
    }
  } else {
    //BODY CAN EXIST
    if (parametersInPath.length === 0) {
      return {
        requestBody: {
          content: {
            'application/json': {
              schema: {
                $ref: `#/components/schemas/${functionBody.input}`,
              },
            },
          },
        },
        input: (request) => request.body,
      }
    }
    if (t.kind === 'object') {
      const parameters = generatePathParameters({ parameters: parametersInPath, module, type: t, typeMap, typeRef })
      const remainingFields = Object.entries(t.type).filter((v) => !parametersInPath.includes(v[0]))
      const remainingObject = object(Object.fromEntries(remainingFields))
      const schema = typeToSchemaObject(parametersInPath[0], remainingObject, module.types, typeMap, typeRef)
      return {
        parameters,
        requestBody: remainingFields.length > 0 ? { content: { 'application/json': { schema } } } : undefined,
        input: (request) => {
          const result = Object.fromEntries(parametersInPath.map((p) => [p, request.params[p]]))
          if (remainingFields.length > 0 && typeof request.body === 'object') {
            return { ...result, ...request.body }
          }
          return result
        },
      }
    }
  }
  throw new Error(
    `Error while generating openapi input type ${functionBody.input}. Not supported. Path ${specification.path}`,
  )
}

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
  const { components, typeMap, typeRef } = openapiComponents({ module, version, api })
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

      const { parameters, requestBody } = generateOpenapiInput({
        specification,
        functionBody,
        module,
        typeMap,
        typeRef,
      })

      const operationObj: OpenAPIV3_1.OperationObject = {
        ...specification.openapi?.specification.parameters,
        parameters: parameters
          ? [...parameters, { name: 'projection', in: 'header', example: true }]
          : [{ name: 'projection', in: 'header', example: true }],
        requestBody,
        responses:
          specification.openapi?.specification.responses === null
            ? undefined
            : specification.openapi?.specification.responses ?? {
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
        description:
          specification.openapi?.specification.description === null
            ? undefined
            : specification.openapi?.specification.description ?? functionBody.opts?.description,
        tags:
          specification.openapi?.specification.tags === null
            ? undefined
            : specification.openapi?.specification.tags ?? specification.namespace === null
            ? []
            : functionBody.namespace ?? specification.namespace
            ? [functionBody.namespace ?? specification.namespace ?? '']
            : [],
        security:
          specification.openapi?.specification.security === null
            ? undefined
            : specification.openapi?.specification.security ?? openapiSecurityRequirements({ module, functionName }),
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
}): {
  components: OpenAPIV3_1.ComponentsObject
  typeMap: Record<string, OpenAPIV3_1.SchemaObject>
  typeRef: Map<Function, string>
} {
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
  for (const [name, type] of Object.entries(module.types).filter(([k]) => usedTypes.includes(k))) {
    const result = typeToSchemaObject(name, type, module.types, typeMap, typeRef)
    schemas[name] = result
  }
  for (const [name, type] of Object.entries(typeMap)) {
    schemas[name] = type
  }
  return { components: { schemas }, typeMap, typeRef }
}

function typeToSchemaObject(
  name: string,
  t: LazyType,
  types: Types,
  typeMap: Record<string, OpenAPIV3_1.SchemaObject>, //type name -> definition
  typeRef: Map<Function, string>, // function -> type name
  ignoreFirstLevelOptionality?: boolean,
): OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.SchemaObject {
  const mt = lazyToType(t)
  if (mt.kind === 'custom' && mt.name === 'void') {
    return { type: 'null', const: 'null', description: 'void' }
  }
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
  const type = typeToSchemaObjectInternal(name, t, types, typeMap, typeRef, ignoreFirstLevelOptionality)
  if (typeof t === 'function' || name in types) {
    if ('anyOf' in type && type.anyOf?.some((v) => '$ref' in v && v.$ref === `#/components/schemas/${name}`)) {
      return type
    }
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
  ignoreFirstLevelOptionality?: boolean,
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
    const subtype = typeToSchemaObject(name, type.type, types, typeMap, typeRef, ignoreFirstLevelOptionality)
    if (ignoreFirstLevelOptionality) {
      return subtype
    }
    return { anyOf: [subtype, { type: 'null', description: 'optional' }] }
  }
  if (type.kind === 'default-decorator') {
    const subtype = typeToSchemaObject(name, type.type, types, typeMap, typeRef, ignoreFirstLevelOptionality)
    if (ignoreFirstLevelOptionality) {
      return subtype
    }
    return {
      anyOf: [
        { ...subtype, example: type.opts.default },
        { type: 'null', description: 'optional' },
      ],
    }
  }
  if (type.kind === 'nullable-decorator') {
    const subtype = typeToSchemaObject(name, type.type, types, typeMap, typeRef, ignoreFirstLevelOptionality)
    if (ignoreFirstLevelOptionality) {
      return subtype
    }
    return { anyOf: [subtype, { const: null }] }
  }
  if (type.kind === 'relation-decorator') {
    const subtype = typeToSchemaObject(name, type.type, types, typeMap, typeRef, ignoreFirstLevelOptionality)
    return { anyOf: [subtype, { type: 'null', description: 'optional' }] }
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
