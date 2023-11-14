import { ApiSpecification, FunctionSpecifications, Request } from './api'
import { decodeQueryObject, encodeQueryObject } from './utils'
import { retrieve, model } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'
import { isArray } from '@mondrian-framework/utils'
import { OpenAPIV3_1 } from 'openapi-types'

export function fromModule<Fs extends functions.FunctionsInterfaces>({
  module,
  api,
  version,
}: {
  module: module.ModuleInterface<Fs>
  api: ApiSpecification<Fs>
  version: number
}): OpenAPIV3_1.Document {
  const paths: OpenAPIV3_1.PathsObject = {}
  const { components, internalData } = openapiComponents({ module, version, api })
  for (const [functionName, functionBody] of Object.entries(module.functions)) {
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
        internalData,
      })
      const schema = modelToSchema(functionBody.output, internalData)
      const errorMap: Record<string, (OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.SchemaObject)[]> = {}
      if (functionBody.errors) {
        const errorCodes = (specification.errorCodes ?? {}) as Record<string, number>
        for (const [errorName, errorType] of Object.entries(functionBody.errors)) {
          const code = (errorCodes[errorName] ?? 400).toString()
          const ts = errorMap[code] ?? []
          const schema = modelToSchema(model.object({ [errorName]: errorType as model.Type }), internalData)
          ts.push(schema)
          errorMap[code] = ts
        }
      }
      const errorSchemas = Object.fromEntries(
        Object.entries(errorMap).map(([key, schemas]) => {
          if (schemas.length === 1) {
            return [
              key,
              {
                description: 'Error',
                content: { 'application/json': { schema: schemas[0] } },
              },
            ] as const
          }
          return [
            key,
            {
              description: 'Error',
              content: { 'application/json': { schema: { anyOf: schemas } } },
            },
          ] as const
        }),
      )
      const retrieveType = retrieve.fromType(functionBody.output, functionBody.retrieve)
      const retrieveOpenapiType = retrieveType.isOk ? modelToSchema(retrieveType.value, internalData) : null
      const retrieveHeader: OpenAPIV3_1.ParameterObject[] = retrieveOpenapiType
        ? [
            {
              name: 'retrieve',
              in: 'header',
              schema: retrieveOpenapiType as OpenAPIV3_1.ReferenceObject, //TODO: it's ok to put a schema here?
              example: {},
            },
          ]
        : []
      const operationObj: OpenAPIV3_1.OperationObject = {
        ...specification.openapi?.specification.parameters,
        parameters: parameters ? [...parameters, ...retrieveHeader] : retrieveHeader,
        requestBody,
        responses:
          specification.openapi?.specification.responses === null
            ? undefined
            : specification.openapi?.specification.responses ?? {
                '200': {
                  description: 'Success',
                  content: { 'application/json': { schema } },
                },
                ...errorSchemas,
              },
        description:
          specification.openapi?.specification.description === null
            ? undefined
            : specification.openapi?.specification.description ?? functionBody.options?.description,
        tags:
          specification.openapi?.specification.tags === null
            ? undefined
            : specification.openapi?.specification.tags ?? specification.namespace === null
            ? []
            : functionBody.options?.namespace ?? specification.namespace
            ? [functionBody.options?.namespace ?? specification.namespace ?? '']
            : [],
        security: specification.security,
      }
      if (paths[path]) {
        ;(paths[path] as Record<string, unknown>)[specification.method.toLocaleLowerCase()] = operationObj
      } else {
        paths[path] = { [specification.method.toLocaleLowerCase()]: operationObj }
      }
    }
  }
  clearInternalData(internalData)
  return {
    openapi: '3.1.0',
    info: { version: module.version, title: module.name },
    servers: [{ url: `${api.options?.pathPrefix ?? '/api'}/v${version}` }],
    paths,
    components: {
      ...components,
      securitySchemes: api.securities,
    },
  }
}

export function generateOpenapiInput({
  specification,
  functionBody,
  internalData,
}: {
  specification: FunctionSpecifications
  functionBody: functions.FunctionInterface<model.Type, model.Type, functions.ErrorType>
  internalData: InternalData
}): {
  parameters?: (OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.ParameterObject)[]
  requestBody?: OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.RequestBodyObject
  input: (request: Request) => unknown
  request: (input: never) => { body?: unknown; params?: Record<string, string>; query?: string }
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
      request: (input) => {
        if (specification.openapi?.request) {
          return specification.openapi.request(input)
        } else {
          throw new Error(`Request builder is not declared!`)
        }
      },
    }
  }
  const parametersInPath = specification.path
    ? [...(specification.path.match(/{(.*?)}/g) ?? [])].map((v) => v.replace('{', '').replace('}', '')).filter((v) => v)
    : []
  const inputType = functionBody.input
  if (model.isNever(inputType)) {
    return {
      parameters: [],
      input: () => null,
      request: () => ({}),
    }
  }
  const concreteInputType = model.concretise(inputType)
  const isScalar = model.isScalar(concreteInputType)
  const isArray = model.isArray(concreteInputType)
  const isRequired = isInputRequired(concreteInputType)
  const t = model.unwrap(concreteInputType)
  if (t.kind === model.Kind.Object || t.kind === model.Kind.Entity) {
    for (const p of parametersInPath) {
      if (!t.fields[p] || !model.isScalar(t.fields[p]) || !isInputRequired(t.fields[p])) {
        throw new Error(
          `Error while generating openapi input type. Path parameter ${p} can only be scalar type and not nullable nor optional. Path ${specification.path}`,
        )
      }
    }
  }
  if (isArray && parametersInPath.length > 0) {
    throw new Error(
      `Error while generating openapi input type. Path parameter with array are not supported. Path ${specification.path}`,
    )
  }
  if (isScalar && parametersInPath.length > 1) {
    throw new Error(
      `Error while generating openapi input type. Only one parameter is needed. Path ${specification.path}`,
    )
  }
  if (isScalar && parametersInPath.length === 1) {
    const schema = modelToSchema(concreteInputType, { ...internalData, ignoreFirstLevelOptionality: true })
    return {
      parameters: [{ in: 'path', name: parametersInPath[0], schema: schema as any, required: true }],
      input: (request) => {
        return request.params[parametersInPath[0]]
      },
      request: (input) => {
        const encoded = concreteInputType.encodeWithoutValidation(input)
        return { params: { [parametersInPath[0]]: `${encoded}` } }
      },
    }
  }
  if (specification.method === 'get' || specification.method === 'delete') {
    if (t.kind === model.Kind.Object) {
      const parameters = generatePathParameters({ parameters: parametersInPath, type: t, internalData })
      for (const [key, subtype] of Object.entries(t.fields)
        .map(([k, v]) => [k, v] as const)
        .filter(([k, _]) => !parametersInPath.includes(k))) {
        const schema = modelToSchema(subtype, { ...internalData, ignoreFirstLevelOptionality: true })
        parameters.push({
          name: key,
          in: 'query',
          required: isInputRequired(subtype),
          style: model.isScalar(subtype) ? undefined : 'deepObject',
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
          for (const [key, subtype] of Object.entries(t.fields).filter(
            ([fieldName]) => !parametersInPath.includes(fieldName),
          )) {
            if (model.isScalar(subtype)) {
              object[key] = request.query[key]
            } else {
              object[key] = decodeQueryObject(request.query, key)
            }
          }
          return object
        },
        request: (input) => {
          const params = Object.fromEntries(
            Object.entries(t.fields)
              .filter(([fieldName]) => parametersInPath.includes(fieldName))
              .map(([fieldName, field]) => {
                const fieldType = model.concretise(field)
                const encoded = fieldType.encodeWithoutValidation(input[fieldName])
                return [fieldName, `${encoded}`] as const
              }),
          )
          const queries = Object.entries(t.fields)
            .filter(([fieldName]) => !parametersInPath.includes(fieldName))
            .map(([fieldName, field]) => {
              const fieldType = model.concretise(field)
              const encoded = fieldType.encodeWithoutValidation(input[fieldName])
              if (model.isScalar(field)) {
                return [fieldName, encoded]
              } else {
                return [fieldName, encodeQueryObject(encoded, fieldName)]
              }
            })
          return { query: queries.map(([k, v]) => `${k}=${v}`).join('&'), params }
        },
      }
    }
    if (parametersInPath.length === 0) {
      const schema = modelToSchema(concreteInputType, { ...internalData, ignoreFirstLevelOptionality: true })
      return {
        parameters: [
          {
            name: specification.inputName ?? 'input',
            in: 'query',
            required: isScalar ? isRequired : true,
            style: isScalar ? undefined : 'deepObject',
            explode: true,
            schema: schema as any,
          },
        ],
        input: (request: Request) => {
          return decodeQueryObject(request.query, specification.inputName ?? 'input')
        },
        request: (input) => {
          const encoded = concreteInputType.encodeWithoutValidation(input)
          const query = encodeQueryObject(encoded, specification.inputName ?? 'input')
          return { query }
        },
      }
    }
  } else {
    //BODY CAN EXIST
    const schema = modelToSchema(concreteInputType, internalData)
    if (parametersInPath.length === 0) {
      return {
        requestBody: {
          content: {
            'application/json': {
              schema: schema as any,
            },
          },
        },
        input: (request) => request.body,
        request: (input) => {
          const body = concreteInputType.encodeWithoutValidation(input)
          return { body }
        },
      }
    }
    if (t.kind === model.Kind.Object || t.kind === model.Kind.Entity) {
      const parameters = generatePathParameters({ parameters: parametersInPath, type: t, internalData })
      const remainingFields = Object.entries(t.fields).filter((v) => !parametersInPath.includes(v[0]))
      const remainingObject = model.object(Object.fromEntries(remainingFields))
      const schema = modelToSchema(remainingObject, internalData)
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
        request: (input) => {
          const params = Object.fromEntries(
            Object.entries(t.fields)
              .filter(([fieldName]) => parametersInPath.includes(fieldName))
              .map(([fieldName, field]) => {
                const fieldType = model.concretise(field)
                const encoded = fieldType.encodeWithoutValidation(input[fieldName])
                return [fieldName, `${encoded}`] as const
              }),
          )
          const body = remainingObject.encodeWithoutValidation(input)
          return { body, params }
        },
      }
    }
  }
  throw new Error(`Error while generating openapi input type. Not supported. Path ${specification.path}`)
}

function isInputRequired(type: model.Type): boolean {
  return !model.isNullable(type) && !model.isOptional(type)
}
function generatePathParameters({
  parameters,
  type,
  internalData,
}: {
  parameters: string[]
  type: model.ObjectType<any, any> | model.EntityType<any, any>
  internalData: InternalData
}): OpenAPIV3_1.ParameterObject[] {
  const result: OpenAPIV3_1.ParameterObject[] = []
  for (const parameter of parameters) {
    const subtype = type.fields[parameter]
    const schema = modelToSchema(subtype, { ...internalData, ignoreFirstLevelOptionality: true })
    result.push({ in: 'path', name: parameter, required: true, schema: schema as any })
  }
  return result
}

function openapiComponents<Fs extends functions.FunctionsInterfaces>({
  module,
  version,
  api,
}: {
  module: module.ModuleInterface<Fs>
  version: number
  api: ApiSpecification<Fs>
}): {
  components: OpenAPIV3_1.ComponentsObject
  internalData: InternalData
} {
  const usedTypes: model.Type[] = []
  for (const [functionName, functionBody] of Object.entries(module.functions)) {
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
      const retrieveType = retrieve.fromType(functionBody.output, functionBody.retrieve)
      if (retrieveType.isOk) {
        usedTypes.push(retrieveType.value)
      }
      usedTypes.push(functionBody.input)
      usedTypes.push(functionBody.output)
    }
  }
  const internalData = emptyInternalData()
  for (const type of usedTypes) {
    modelToSchema(type, internalData)
  }
  const schemas: Record<string, OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.SchemaObject> = {}
  for (const [name, type] of internalData.typeMap.entries()) {
    schemas[name] = type
  }
  return { components: { schemas }, internalData }
}

export function emptyInternalData(): InternalData {
  return { typeMap: new Map(), typeRef: new Map() }
}

export function clearInternalData(internalData: InternalData) {
  internalData.typeMap.clear()
  internalData.typeRef.clear()
}

type InternalData = {
  typeMap: Map<string, OpenAPIV3_1.SchemaObject> //type name -> SchemaObject
  typeRef: Map<model.Type, string> // type -> type name
  ignoreFirstLevelOptionality?: boolean
}

function modelToSchema(
  type: model.Type,
  internalData: InternalData,
): OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.SchemaObject {
  //if alredy processed (or just processing) return the reference
  if (typeof type === 'function') {
    const typeName = internalData.typeRef.get(type)
    if (typeName !== undefined) {
      return { $ref: `#/components/schemas/${typeName}` }
    }
  }
  const concreteType = model.concretise(type)
  const typeName = concreteType.options?.name
  //if it has a name set that as already processed so the next iteration we ealry return the reference
  if (typeName !== undefined) {
    internalData.typeRef.set(type, typeName)
  }
  const schema = model.match(type, {
    string: (type) => stringToOpenAPIComponent(type),
    number: (type) => numberToOpenAPIComponent(type),
    boolean: (type) => booleanToOpenAPIComponent(type),
    enum: (type) => enumToOpenAPIComponent(type),
    literal: (type) => literalToOpenAPIComponent(type),
    custom: (type) => customToOpenAPIComponent(type, internalData),
    array: (type) => arrayToOpenAPIComponent(type, internalData),
    nullable: (type) => nullableToOpenAPIComponent(type, internalData),
    optional: (type) => optionalToOpenAPIComponent(type, internalData),
    record: (type) => recordToOpenAPIComponent(type, internalData),
    union: (type) => unionToOpenAPIComponent(type, internalData),
  })
  //if the schema is a SchemaObject and has a name, set it to the type map and return the reference
  if (!('$ref' in schema) && typeName !== undefined) {
    internalData.typeMap.set(typeName, schema)
    return { $ref: `#/components/schemas/${typeName}` }
  }
  return schema
}

function stringToOpenAPIComponent(type: model.StringType): OpenAPIV3_1.NonArraySchemaObject {
  return {
    type: 'string',
    pattern: type.options?.regex?.source,
    minLength: type.options?.minLength,
    maxLength: type.options?.maxLength,
    description: type.options?.description,
  }
}

function numberToOpenAPIComponent(type: model.NumberType): OpenAPIV3_1.NonArraySchemaObject {
  return {
    type: type.options?.isInteger ? 'integer' : 'number',
    maximum: type.options?.maximum,
    minimum: type.options?.minimum,
    exclusiveMaximum: type.options?.exclusiveMaximum,
    exclusiveMinimum: type.options?.exclusiveMinimum,
    description: type.options?.description,
  }
}

function booleanToOpenAPIComponent(type: model.BooleanType): OpenAPIV3_1.NonArraySchemaObject {
  return {
    type: 'boolean',
    description: type.options?.description,
  }
}

function enumToOpenAPIComponent(type: model.EnumType): OpenAPIV3_1.NonArraySchemaObject {
  return {
    type: 'string',
    enum: type.variants as unknown as string[],
    description: type.options?.description,
  }
}

function literalToOpenAPIComponent(type: model.LiteralType): OpenAPIV3_1.NonArraySchemaObject {
  const literalType = typeof type.literalValue
  const literalSupportedType =
    literalType === 'boolean'
      ? literalType
      : literalType === 'number'
      ? literalType
      : literalType === 'string'
      ? literalType
      : 'unknown'
  if (type.literalValue === null) {
    return {
      type: 'null',
      const: 'null',
      description: type.options?.description,
    }
  }
  if (literalSupportedType === 'unknown') {
    throw new Error(`[OpenAPI generation] Unknown literal type: ${literalSupportedType}`)
  }
  return {
    type: literalSupportedType,
    const: type.literalValue,
    example: type.literalValue,
    description: type.options?.description,
  }
}

function customToOpenAPIComponent(
  type: model.CustomType,
  internalData: InternalData,
): OpenAPIV3_1.NonArraySchemaObject {
  //convert known types based on name
  if (type.typeName === model.record(model.unknown()).typeName) {
    const fieldSchema = modelToSchema((type.options as model.RecordOptions).fieldsType, internalData)
    return {
      type: 'object',
      additionalProperties: fieldSchema,
      description: type.options?.description,
    }
  } else if (type.typeName === model.datetime().typeName) {
    return {
      type: 'string',
      format: 'date-time',
      description: type.options?.description,
    }
  } else if (type.typeName === model.timestamp().typeName) {
    return {
      type: 'integer',
      description: type.options?.description ?? 'unix timestamp',
    }
  } else if (type.typeName === model.email().typeName) {
    return {
      type: 'string',
      format: 'email',
      description: type.options?.description,
    }
  } else if (type.typeName === model.never().typeName) {
    return {}
  } else if (type.typeName === model.unknown().typeName) {
    return {}
  }

  //TODO [Good first issue]: complete with other known custom type
  //...

  //otherwise don't known how to convert this type to openapi
  console.warn(`[OpenAPI generation] don't known how to properly map custom type "${type.typeName}"`)
  return {
    description: type.options?.description,
  }
}

function arrayToOpenAPIComponent(
  type: model.ArrayType<model.Mutability, model.Type>,
  internalData: InternalData,
): OpenAPIV3_1.ArraySchemaObject {
  const schema = modelToSchema(type.wrappedType, { ...internalData, ignoreFirstLevelOptionality: undefined })
  return {
    type: 'array',
    items: schema,
    description: type.options?.description,
  }
}

function optionalToOpenAPIComponent(
  type: model.OptionalType<model.Type>,
  internalData: InternalData,
): OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.SchemaObject {
  const schema = modelToSchema(type.wrappedType, {
    ...internalData,
    ignoreFirstLevelOptionality: undefined,
  })
  if (internalData.ignoreFirstLevelOptionality) {
    return schema
  }
  const optionalSchema: OpenAPIV3_1.NonArraySchemaObject = { type: 'null', description: 'optional' }
  return {
    anyOf: [schema, optionalSchema],
    description: type.options?.description,
  }
}

function nullableToOpenAPIComponent(
  type: model.NullableType<model.Type>,
  internalData: InternalData,
): OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.SchemaObject {
  const schema = modelToSchema(type.wrappedType, {
    ...internalData,
    ignoreFirstLevelOptionality: undefined,
  })
  if (internalData.ignoreFirstLevelOptionality) {
    return schema
  }
  const optionalSchema: OpenAPIV3_1.NonArraySchemaObject = { const: null }
  return {
    anyOf: [schema, optionalSchema],
    description: type.options?.description,
  }
}

function unionToOpenAPIComponent(
  type: model.UnionType<model.Types>,
  internalData: InternalData,
): OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.SchemaObject {
  const anyOf = Object.values(type.variants).map((t) => modelToSchema(t, internalData))
  return {
    anyOf,
    description: type.options?.description,
  }
}

function recordToOpenAPIComponent(
  type: model.EntityType<model.Mutability, model.Types> | model.ObjectType<model.Mutability, model.Types>,
  internalData: InternalData,
): OpenAPIV3_1.NonArraySchemaObject {
  const fields = Object.entries(type.fields).map(([fieldName, fieldType]) => {
    const hasToBeOptional = model.unwrap(fieldType).kind === model.Kind.Entity && !model.isOptional(fieldType)
    const schema = modelToSchema(hasToBeOptional ? model.optional(fieldType) : fieldType, internalData)
    return [fieldName, schema] as const
  })
  const isOptional: (
    type: OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.SchemaObject,
  ) => { optional: true; subtype: OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.SchemaObject } | false = (type) =>
    'anyOf' in type && type.anyOf && type.anyOf.length === 2 && type.anyOf[1].description === 'optional'
      ? { optional: true, subtype: type.anyOf[0] }
      : false
  const schema: OpenAPIV3_1.SchemaObject = {
    type: 'object',
    required: fields.filter(([_, type]) => isOptional(type) === false).map((v) => v[0]),
    properties: Object.fromEntries(
      fields.map(([name, type]) => {
        const isOpt = isOptional(type)
        if (isOpt !== false) {
          return [name, isOpt.subtype]
        }
        return [name, type]
      }),
    ),
    description: type.options?.description,
  }
  return schema
}
