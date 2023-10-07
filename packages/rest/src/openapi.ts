import { Api, FunctionSpecifications, Request } from './api'
import { decodeQueryObject, encodeQueryObject } from './utils'
import { types } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'
import { assertNever, isArray } from '@mondrian-framework/utils'
import { OpenAPIV3_1 } from 'openapi-types'

export function fromModule<Fs extends functions.Functions, ContextInput>({
  module,
  api,
  version,
}: {
  module: module.Module<Fs, ContextInput>
  api: Api<Fs>
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
      const errorType = types.concretise(functionBody.error)
      const errorMap: Record<string, (OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.SchemaObject)[]> = {}
      const errorCodes = (specification.errorCodes ?? {}) as Record<string, number>
      if (errorType.kind === types.Kind.Union) {
        for (const [variantName, variantType] of Object.entries(errorType.variants)) {
          const code = (errorCodes[variantName] ?? 400).toString()
          const ts = errorMap[code] ?? []
          const { schema } = typeToSchemaObject(
            types.object({ [variantName]: variantType as types.Type }),
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
        /*security:
          specification.openapi?.specification.security === null
            ? undefined
            : specification.openapi?.specification.security ?? openapiSecurityRequirements({ module, functionName }),*/
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
    servers: [{ url: `${`/${module.name.toLocaleLowerCase()}${api.options?.pathPrefix ?? '/api'}`}/v${version}` }],
    paths,
    components: {
      ...components,
      securitySchemes: {
        _: { type: 'http', scheme: 'bearer' },
      } /*, securitySchemes: openapiSecuritySchemes({ module }) */,
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
  functionBody: functions.FunctionInterface
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
  const inputType = types.concretise(functionBody.input)
  const isScalar = types.isScalar(inputType)
  const isArray = types.isArray(inputType)
  const isRequired = isInputRequired(inputType)
  const t = types.unwrap(inputType)
  if (t.kind === types.Kind.Object) {
    for (const p of parametersInPath) {
      if (!t.fields[p] || !types.isScalar(t.fields[p]) || !isInputRequired(t.fields[p])) {
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
    const { schema } = typeToSchemaObject(inputType, typeMap, typeRef, true)
    return {
      parameters: [{ in: 'path', name: parametersInPath[0], schema: schema as any, required: true }],
      input: (request) => {
        return request.params[parametersInPath[0]]
      },
      request: (input) => {
        const encoded = inputType.encodeWithoutValidation(input)
        return { params: { [parametersInPath[0]]: `${encoded}` } }
      },
    }
  }
  if (specification.method === 'get' || specification.method === 'delete') {
    if (t.kind === types.Kind.Object) {
      const parameters = generatePathParameters({ parameters: parametersInPath, type: t, typeMap, typeRef })
      for (const [key, subtype] of Object.entries(t.fields)
        .map(([k, v]) => [k, types.unwrapField(v)] as const)
        .filter(([k, _]) => !parametersInPath.includes(k))) {
        const { schema } = typeToSchemaObject(subtype, typeMap, typeRef, true)
        parameters.push({
          name: key,
          in: 'query',
          required: isInputRequired(subtype),
          style: types.isScalar(subtype) ? undefined : 'deepObject',
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
            if (types.isScalar(subtype)) {
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
                const fieldType = types.concretise(types.unwrapField(field))
                const encoded = fieldType.encodeWithoutValidation(input[fieldName])
                return [fieldName, `${encoded}`] as const
              }),
          )
          const queries = Object.entries(t.fields)
            .filter(([fieldName]) => !parametersInPath.includes(fieldName))
            .map(([fieldName, field]) => {
              const fieldType = types.concretise(types.unwrapField(field))
              const encoded = fieldType.encodeWithoutValidation(input[fieldName])
              if (types.isScalar(field)) {
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
      const { schema } = typeToSchemaObject(inputType, typeMap, typeRef, true)
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
          const encoded = inputType.encodeWithoutValidation(input)
          const query = encodeQueryObject(encoded, specification.inputName ?? 'input')
          return { query }
        },
      }
    }
  } else {
    //BODY CAN EXIST
    const { schema } = typeToSchemaObject(inputType, typeMap, typeRef)
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
          const body = inputType.encodeWithoutValidation(input)
          return { body }
        },
      }
    }
    if (t.kind === types.Kind.Object) {
      const parameters = generatePathParameters({ parameters: parametersInPath, type: t, typeMap, typeRef })
      const remainingFields = Object.entries(t.fields).filter((v) => !parametersInPath.includes(v[0]))
      const remainingObject = types.object(Object.fromEntries(remainingFields))
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
                const fieldType = types.concretise(types.unwrapField(field))
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

function isInputRequired(type: types.Type | types.Field): boolean {
  const t = types.unwrapField(type)
  return !types.isNullable(t) && !types.isOptional(t)
}
function generatePathParameters({
  parameters,
  type,
  typeMap,
  typeRef,
}: {
  parameters: string[]
  type: types.ObjectType<any, any>
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

/*
function openapiSecurityRequirements({
  module,
  functionName,
}: {
  module: module.Module<any, any>
  functionName: string
}): OpenAPIV3_1.SecurityRequirementObject[] | undefined {
  const auth = (module.functionOptions ?? {})[functionName]?.authentication
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
  module: module.Module<any, any>
}): Record<string, OpenAPIV3_1.SecuritySchemeObject> | undefined {
  const defaultSchema: OpenAPIV3_1.SecuritySchemeObject | undefined = module.authentication
    ? { type: 'http', scheme: module.authentication.type, bearerFormat: module.authentication.format }
    : undefined
  const schemas = Object.fromEntries(
    Object.entries(module.functionOptions ?? {}).flatMap(([k, v]) => {
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
*/

function openapiComponents<Fs extends functions.Functions, ContextInput>({
  module,
  version,
  api,
}: {
  module: module.Module<Fs, ContextInput>
  version: number
  api: Api<Fs>
}): {
  components: OpenAPIV3_1.ComponentsObject
  typeMap: Record<string, OpenAPIV3_1.SchemaObject>
  typeRef: Map<Function, string>
} {
  const usedTypes: types.Type[] = []
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
  t: types.Type,
  typeMap: Record<string, OpenAPIV3_1.SchemaObject>, //type name -> definition
  typeRef: Map<Function, string>, // function -> type name
  ignoreFirstLevelOptionality?: boolean,
): { name: string | undefined; schema: OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.SchemaObject } {
  const type = types.concretise(t)
  if (type.kind === types.Kind.Custom && type.typeName === 'unknown') {
    return { name: 'unknown', schema: {} }
  }
  if (typeof t === 'function') {
    const n = typeRef.get(t)
    if (n) {
      return { name: n, schema: { $ref: `#/components/schemas/${n}` } }
    }
    if (type.options?.name) {
      typeRef.set(t, type.options.name)
    }
  }
  const { name, schema } = typeToSchemaObjectInternal(t, typeMap, typeRef, ignoreFirstLevelOptionality)
  if (name) {
    if (!typeMap[name]) {
      typeMap[name] = schema
    }
    return { name, schema: { $ref: `#/components/schemas/${name}` } }
  }
  return { name: undefined, schema }
}

function typeToSchemaObjectInternal(
  t: types.Type,
  typeMap: Record<string, OpenAPIV3_1.SchemaObject>, //type name -> definition
  typeRef: Map<Function, string>, // function -> type name
  ignoreFirstLevelOptionality?: boolean,
): { name: string | undefined; schema: OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.SchemaObject } {
  const type = types.concretise(t)
  const name: string | undefined = type.options?.name
  const description = type.options?.description
  if (type.kind === types.Kind.String) {
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
  if (type.kind === types.Kind.Custom) {
    //convert known types based on name
    if (type.typeName === types.record(types.unknown()).typeName) {
      const fieldsType = typeToSchemaObject((type.options as types.RecordOptions).fieldsType, typeMap, typeRef)
      return { name, schema: { type: 'object', additionalProperties: fieldsType.schema, description } }
    } else if (type.typeName === types.dateTime().typeName) {
      return { name, schema: { type: 'string', format: 'date-time', description } }
    } else if (type.typeName === types.timestamp().typeName) {
      return { name, schema: { type: 'integer', description: description ?? 'unix timestamp' } }
    }
    //otherwise don't known how to convert this type to openapi
    return { name, schema: { description } }
  }
  if (type.kind === types.Kind.Boolean) {
    return { name, schema: { type: 'boolean', description } }
  }
  if (type.kind === types.Kind.Number) {
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
  if (type.kind === types.Kind.Literal) {
    const t = typeof type.literalValue
    const tp = t === 'boolean' ? t : t === 'number' ? t : t === 'string' ? t : null
    if (type.literalValue === null) {
      return { name, schema: { type: 'null', const: 'null', description } }
    }
    if (tp === null) {
      throw new Error(`Unknown literal type: ${tp}`)
    }
    return {
      name,
      schema: {
        type: tp,
        const: type.literalValue,
        example: type.literalValue,
        description,
      },
    }
  }
  if (type.kind === types.Kind.Array) {
    const { schema } = typeToSchemaObject(type.wrappedType, typeMap, typeRef)
    return { name, schema: { type: 'array', items: schema, description } }
  }
  if (type.kind === types.Kind.Optional) {
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
  if (type.kind === types.Kind.Nullable) {
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
  if (type.kind === types.Kind.Object) {
    const fields = Object.entries(type.fields as types.Fields).map(([fieldName, field]) => {
      const fieldType = types.unwrapField(field)
      const { schema } = typeToSchemaObject(
        'virtual' in field ? types.optional(fieldType) : fieldType,
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
  if (type.kind === types.Kind.Enum) {
    return {
      name,
      schema: {
        type: 'string',
        enum: type.variants,
        description,
      } as const,
    }
  }
  if (type.kind === types.Kind.Union) {
    const uniontypes = Object.entries(type.variants).map(
      ([k, t]) => typeToSchemaObject(types.object({ [k]: t as types.Type }), typeMap, typeRef).schema,
    )
    return { name, schema: { anyOf: uniontypes, description } }
  }
  return assertNever(type)
}
