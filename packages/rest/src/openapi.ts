import { ApiSpecification, FunctionSpecifications, Request } from './api'
import { decodeQueryObject, encodeQueryObject } from './utils'
import { retrieve, model } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'
import { assertNever, isArray } from '@mondrian-framework/utils'
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
  const { components, typeMap, typeRef } = openapiComponents({ module, version, api })
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
        typeMap,
        typeRef,
      })
      const { schema } = typeToSchemaObject(functionBody.output, typeMap, typeRef)
      const errorMap: Record<string, (OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.SchemaObject)[]> = {}
      if (functionBody.errors) {
        const errorCodes = (specification.errorCodes ?? {}) as Record<string, number>
        for (const [errorName, errorType] of Object.entries(functionBody.errors)) {
          const code = (errorCodes[errorName] ?? 400).toString()
          const ts = errorMap[code] ?? []
          const { schema } = typeToSchemaObject(
            model.object({ [errorName]: errorType as model.Type }),
            typeMap,
            typeRef,
          )
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
      const retrieveOpenapiType = retrieveType.isOk ? typeToSchemaObject(retrieveType.value, typeMap, typeRef) : null
      const retrieveHeader: OpenAPIV3_1.ParameterObject[] = retrieveOpenapiType
        ? [
            {
              name: 'retrieve',
              in: 'header',
              schema: retrieveOpenapiType.schema as OpenAPIV3_1.ReferenceObject, //TODO: it's ok to put a schema here?
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
  typeMap,
  typeRef,
}: {
  specification: FunctionSpecifications
  functionBody: functions.FunctionInterface<model.Type, model.Type, functions.ErrorType>
  typeMap: Record<string, OpenAPIV3_1.SchemaObject>
  typeRef: Map<Function, string>
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
    const { schema } = typeToSchemaObject(concreteInputType, typeMap, typeRef, true)
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
      const parameters = generatePathParameters({ parameters: parametersInPath, type: t, typeMap, typeRef })
      for (const [key, subtype] of Object.entries(t.fields)
        .map(([k, v]) => [k, v] as const)
        .filter(([k, _]) => !parametersInPath.includes(k))) {
        const { schema } = typeToSchemaObject(subtype, typeMap, typeRef, true)
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
      const { schema } = typeToSchemaObject(concreteInputType, typeMap, typeRef, true)
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
        input: (request: Request) => decodeQueryObject(request.query, specification.inputName ?? 'input'),
        request: (input) => {
          const encoded = concreteInputType.encodeWithoutValidation(input)
          const query = encodeQueryObject(encoded, specification.inputName ?? 'input')
          return { query }
        },
      }
    }
  } else {
    //BODY CAN EXIST
    const { schema } = typeToSchemaObject(concreteInputType, typeMap, typeRef)
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
      const parameters = generatePathParameters({ parameters: parametersInPath, type: t, typeMap, typeRef })
      const remainingFields = Object.entries(t.fields).filter((v) => !parametersInPath.includes(v[0]))
      const remainingObject = model.object(Object.fromEntries(remainingFields))
      const { schema } = typeToSchemaObject(remainingObject, typeMap, typeRef)
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
  typeMap,
  typeRef,
}: {
  parameters: string[]
  type: model.ObjectType<any, any> | model.EntityType<any, any>
  typeMap: Record<string, OpenAPIV3_1.SchemaObject>
  typeRef: Map<Function, string>
}): OpenAPIV3_1.ParameterObject[] {
  const result: OpenAPIV3_1.ParameterObject[] = []
  for (const parameter of parameters) {
    const subtype = type.fields[parameter]
    const { schema } = typeToSchemaObject(subtype, typeMap, typeRef, true)
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
  typeMap: Record<string, OpenAPIV3_1.SchemaObject>
  typeRef: Map<Function, string>
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
  const schemas: Record<string, OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.SchemaObject> = {}
  const typeMap: Record<string, OpenAPIV3_1.SchemaObject> = {}
  const typeRef: Map<Function, string> = new Map()
  for (const type of usedTypes) {
    typeToSchemaObject(type, typeMap, typeRef)
  }
  for (const [name, type] of Object.entries(typeMap)) {
    schemas[name] = type
  }
  return { components: { schemas }, typeMap, typeRef }
}

function typeToSchemaObject(
  type: model.Type,
  typeMap: Record<string, OpenAPIV3_1.SchemaObject>, //type name -> definition
  typeRef: Map<Function, string>, // function -> type name
  ignoreFirstLevelOptionality?: boolean,
): { name: string | undefined; schema: OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.SchemaObject } {
  let lazyTypeName: string | null = null
  if (typeof type === 'function') {
    const alreadyConvertedTypeName = typeRef.get(type)
    if (alreadyConvertedTypeName) {
      return { name: alreadyConvertedTypeName, schema: { $ref: `#/components/schemas/${alreadyConvertedTypeName}` } }
    }
    lazyTypeName = model.concretise(type()).options?.name ?? `ANONYMOUS_TYPE_${typeRef.size}`
    typeRef.set(type, lazyTypeName)
  }
  const { name, schema } = typeToSchemaObjectInternal(type, lazyTypeName, typeMap, typeRef, ignoreFirstLevelOptionality)
  if (name) {
    if (!typeMap[name]) {
      typeMap[name] = schema
    }
    return { name, schema: { $ref: `#/components/schemas/${name}` } }
  } else {
    return { name: undefined, schema }
  }
}

function typeToSchemaObjectInternal(
  t: model.Type,
  nameOverride: string | null,
  typeMap: Record<string, OpenAPIV3_1.SchemaObject>, //type name -> definition
  typeRef: Map<Function, string>, // function -> type name
  ignoreFirstLevelOptionality?: boolean,
): { name: string | undefined; schema: OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.SchemaObject } {
  const type = model.concretise(t)
  const name: string | undefined = nameOverride ?? type.options?.name
  const description = type.options?.description
  if (type.kind === model.Kind.String) {
    return {
      name,
      schema: {
        type: 'string',
        pattern: type.options?.regex?.source,
        minLength: type.options?.minLength,
        maxLength: type.options?.maxLength,
        description,
      },
    }
  }
  if (type.kind === model.Kind.Custom) {
    //convert known types based on name
    if (type.typeName === model.record(model.unknown()).typeName) {
      const fieldsType = typeToSchemaObject((type.options as model.RecordOptions).fieldsType, typeMap, typeRef)
      return { name, schema: { type: 'object', additionalProperties: fieldsType.schema, description } }
    } else if (type.typeName === model.datetime().typeName) {
      return { name, schema: { type: 'string', format: 'date-time', description } }
    } else if (type.typeName === model.timestamp().typeName) {
      return { name, schema: { type: 'integer', description: description ?? 'unix timestamp' } }
    }
    //otherwise don't known how to convert this type to openapi
    return { name, schema: { description } }
  }
  if (type.kind === model.Kind.Boolean) {
    return { name, schema: { type: 'boolean', description } }
  }
  if (type.kind === model.Kind.Number) {
    return {
      name,
      schema: {
        type: type.options?.isInteger ? 'integer' : 'number',
        maximum: type.options?.maximum,
        minimum: type.options?.minimum,
        exclusiveMaximum: type.options?.exclusiveMaximum,
        exclusiveMinimum: type.options?.exclusiveMinimum,
        description,
      },
    }
  }
  if (type.kind === model.Kind.Literal) {
    const t = typeof type.literalValue
    const tp = t === 'boolean' ? t : t === 'number' ? t : t === 'string' ? t : null
    if (type.literalValue === null) {
      return { name, schema: { type: 'null', const: 'null', description } }
    }
    if (tp === null) {
      throw new Error(`Unknown literal type: ${tp}`)
    }
    return { name, schema: { type: tp, const: type.literalValue, example: type.literalValue, description } }
  }
  if (type.kind === model.Kind.Array) {
    const { schema } = typeToSchemaObject(type.wrappedType, typeMap, typeRef)
    return { name, schema: { type: 'array', items: schema, description } }
  }
  if (type.kind === model.Kind.Optional) {
    const { name: subname, schema } = typeToSchemaObject(
      type.wrappedType,
      typeMap,
      typeRef,
      ignoreFirstLevelOptionality,
    )
    if (ignoreFirstLevelOptionality) {
      return { name: subname, schema }
    }
    return { name, schema: { anyOf: [schema, { type: 'null', description: 'optional' }], description } }
  }
  if (type.kind === model.Kind.Nullable) {
    const { name: subname, schema } = typeToSchemaObject(
      type.wrappedType,
      typeMap,
      typeRef,
      ignoreFirstLevelOptionality,
    )
    if (ignoreFirstLevelOptionality) {
      return { name: subname, schema }
    }
    return { name, schema: { anyOf: [schema, { const: null }], description } }
  }
  if (type.kind === model.Kind.Object || type.kind === model.Kind.Entity) {
    const fields = Object.entries(type.fields as model.Types).map(([fieldName, fieldType]) => {
      const { schema } = typeToSchemaObject(
        model.unwrap(fieldType).kind === model.Kind.Entity && !model.isOptional(fieldType)
          ? model.optional(fieldType)
          : fieldType,
        typeMap,
        typeRef,
      )
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
      description,
    }
    return { name, schema }
  }
  if (type.kind === model.Kind.Enum) {
    return {
      name,
      schema: {
        type: 'string',
        enum: type.variants as unknown as string[],
        description,
      } as const,
    }
  }
  if (type.kind === model.Kind.Union) {
    const anyOf = Object.values(type.variants).map((t) => typeToSchemaObject(t as model.Type, typeMap, typeRef).schema)
    return { name, schema: { anyOf, description } }
  }
  return assertNever(type)
}
