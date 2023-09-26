import { createGraphQLError } from '@graphql-tools/utils'
import { types } from '@mondrian-framework/model'
import { JSONType, assertNever, capitalise, mapObject, toCamelCase } from '@mondrian-framework/utils'
import {
  GraphQLScalarType,
  GraphQLObjectType,
  GraphQLEnumType,
  GraphQLString,
  GraphQLList,
  GraphQLNonNull,
  GraphQLBoolean,
  GraphQLInt,
  getNullableType,
  GraphQLUnionType,
  GraphQLOutputType,
} from 'graphql'

/**
 * TODO: vedere se negli scalari da un suggerimento su cosa inserire (numero/stringa)
 *
 */

export function typeToGraphQLType(type: types.Type): GraphQLOutputType {
  return typeToGraphQLTypeInternal(types.concretise(type), {
    inspectedTypes: new Set(),
    knownTypes: new Map(),
    knownCustomTypes: new Map(),
    defaultName: undefined,
  })
}

function generateName(type: types.Type, defaultName: string | undefined): string {
  const concreteType = types.concretise(type)
  return concreteType.options?.name ?? defaultName ?? 'TYPE' + Math.floor(Math.random() * 100_000_000)
}

type InternalData = {
  inspectedTypes: Set<types.Type>
  knownTypes: Map<types.Type, GraphQLOutputType>
  knownCustomTypes: Map<string, GraphQLScalarType>
  defaultName: string | undefined
}

function typeToGraphQLTypeInternal(type: types.Type, internalData: InternalData): GraphQLOutputType {
  const { inspectedTypes, knownTypes, defaultName } = internalData
  if (inspectedTypes.has(type)) {
    return knownTypes.get(type)!!
  } else {
    inspectedTypes.add(type)
    let graphQLType = undefined
    const concreteType = types.concretise(type)
    if (concreteType.kind === types.Kind.Number) {
      graphQLType = scalarOrDefault(concreteType, GraphQLInt, defaultName)
    } else if (concreteType.kind === types.Kind.String) {
      graphQLType = scalarOrDefault(concreteType, GraphQLString, defaultName)
    } else if (concreteType.kind === types.Kind.Boolean) {
      graphQLType = scalarOrDefault(concreteType, GraphQLBoolean, defaultName)
    } else if (concreteType.kind === types.Kind.Enum) {
      graphQLType = enumToGraphQLType(concreteType, defaultName)
    } else if (concreteType.kind === types.Kind.Literal) {
      graphQLType = literalToGraphQLType(concreteType, defaultName)
    } else if (concreteType.kind === types.Kind.Union) {
      graphQLType = unionToGraphQLType(concreteType, internalData)
    } else if (concreteType.kind === types.Kind.Object) {
      graphQLType = objectToGraphQLType(concreteType, internalData)
    } else if (concreteType.kind === types.Kind.Array) {
      graphQLType = arrayToGraphQLType(concreteType, internalData)
    } else if (concreteType.kind === types.Kind.Optional || concreteType.kind === types.Kind.Nullable) {
      const type = typeToGraphQLTypeInternal(concreteType.wrappedType, internalData)
      graphQLType = getNullableType(type)
    } else if (concreteType.kind === types.Kind.Custom) {
      graphQLType = customTypeToGraphQLType(concreteType, internalData) //scalarFromType(concreteType, concreteType.options?.description, defaultName)
    } else {
      assertNever(concreteType)
    }
    knownTypes.set(type, graphQLType)
    return graphQLType
  }
}

function scalarOrDefault<T extends types.Type>(
  type: T,
  defaultType: GraphQLOutputType,
  defaultName: string | undefined,
): GraphQLOutputType {
  const concreteType = types.concretise(type)
  const options = concreteType.options
  return !options ? defaultType : scalarFromType(concreteType, options.description, defaultName)
}

function scalarFromType<T extends types.Type>(
  type: types.Concrete<T>,
  description: string | undefined,
  defaultName: string | undefined,
): GraphQLScalarType<types.Infer<T>, JSONType> {
  const name = generateName(type, defaultName)
  // TODO: add parseValue and parseLiteral
  const serialize = (value: unknown) => {
    if (!types.isType(type, value)) {
      throw createGraphQLError('Unexpected type in serialize')
    } else {
      const result = type.encode(value as never)
      if (result.isOk) {
        return result.value
      } else {
        throw createGraphQLError('GraphQL serialization failed')
      }
    }
  }
  return new GraphQLScalarType<types.Infer<T>, JSONType>({ name, description, serialize })
}

function enumToGraphQLType(
  enumeration: types.EnumType<readonly [string, ...string[]]>,
  defaultName: string | undefined,
): GraphQLEnumType {
  const name = generateName(enumeration, defaultName)
  const variants = enumeration.variants.map((variant, index) => [variant, { value: index }])
  const values = Object.fromEntries(variants)
  return new GraphQLEnumType({ name, values })
}

function literalToGraphQLType(
  literal: types.LiteralType<number | string | null | boolean>,
  defaultName: string | undefined,
): GraphQLEnumType {
  const name = generateName(literal, defaultName)
  const rawLiteralName = literal.literalValue?.toString().trim() ?? 'null'
  const literalName = `Literal${toCamelCase(rawLiteralName)}`
  const values = Object.fromEntries([[literalName, { value: 0 }]])
  return new GraphQLEnumType({ name, values })
}

function arrayToGraphQLType(
  array: types.ArrayType<any, any>,
  internalData: InternalData,
): GraphQLList<GraphQLOutputType> {
  const { defaultName } = internalData
  const arrayName = generateName(array, defaultName)
  const itemDefaultName = arrayName + 'Item'
  const itemsType = typeToGraphQLTypeInternal(array.wrappedType, { ...internalData, defaultName: itemDefaultName })
  const wrappedType = types.isOptional(array.wrappedType) ? itemsType : new GraphQLNonNull(itemsType)
  return new GraphQLList(wrappedType)
}

function objectToGraphQLType(
  object: types.ObjectType<any, types.Types>,
  internalData: InternalData,
): GraphQLObjectType {
  const { defaultName } = internalData
  const objectName = generateName(object, defaultName)
  const fields = () => mapObject(object.fields, typeToGraphQLObjectField(internalData, objectName))
  return new GraphQLObjectType({ name: objectName, fields })
}

function typeToGraphQLObjectField(
  internalData: InternalData,
  objectName: string,
): (fieldName: string, fieldType: types.Type) => { type: GraphQLOutputType } {
  return (fieldName, fieldType) => {
    const fieldDefaultName = generateName(fieldType, objectName + capitalise(fieldName))
    const concreteType = types.concretise(fieldType)
    const graphQLType = typeToGraphQLTypeInternal(concreteType, { ...internalData, defaultName: fieldDefaultName })
    const canBeMissing = types.isOptional(concreteType) || types.isNullable(concreteType)
    return { type: canBeMissing ? graphQLType : new GraphQLNonNull(graphQLType) }
  }
}

function unionToGraphQLType(union: types.UnionType<types.Types>, internalData: InternalData): GraphQLUnionType {
  const { defaultName } = internalData
  const unionName = generateName(union, defaultName)
  const types = Object.entries(union.variants).map(([name, variantType]) => {
    const variantName = unionName + capitalise(name)
    const variantValueDefaultName = name + 'Value'
    const value = typeToGraphQLTypeInternal(variantType, { ...internalData, defaultName: variantValueDefaultName })
    const field = Object.fromEntries([[name, { type: value }]])
    return new GraphQLObjectType({ name: variantName, fields: field })
  })
  return new GraphQLUnionType({ name: unionName, types })
}

function customTypeToGraphQLType(
  type: types.CustomType<string, any, any>,
  internalData: InternalData,
): GraphQLScalarType {
  const { knownCustomTypes } = internalData
  const knownType = knownCustomTypes.get(type.typeName)
  if (knownType) {
    return knownType
  } else {
    const scalar = scalarFromType(type, type.options?.description, capitalise(type.typeName))
    knownCustomTypes.set(type.typeName, scalar)
    return scalar
  }
}

// type GraphqlType =
//   | { type: 'scalar'; description?: string; impl: types.CustomType<string, {}, any> }
//   | { type: 'type' | 'input' | 'enum'; definition?: string; description?: string }
//   | {
//       type: 'union'
//       definition: string
//       description?: string
//       is?: Record<string, undefined | ((v: unknown) => boolean)>
//     }

/*
function typeToGqlType(
  t: types.Type,
  typeMap: Record<string, GraphqlType>, //id -> definition
  typeRef: Map<Function, string>, // function -> id
  isInput: boolean,
  isOptional: boolean,
  suggestedName?: string,
): string {
  const mt = types.concretise(t)
  if (typeof t === 'function') {
    const id = typeRef.get(t)
    if (id) {
      return `${isInput ? 'I' : ''}${id}${isOptional ? '' : '!'}`
    }
    if (mt.options?.name) {
      typeRef.set(t, mt.options.name)
    }
  }
  return typeToGqlTypeInternal(t, typeMap, typeRef, isInput, isOptional, suggestedName)
}
function typeToGqlTypeInternal(
  t: types.Type,
  typeMap: Record<string, GraphqlType>, //type name -> definition
  typeRef: Map<Function, string>, // function -> type name
  isInput: boolean,
  isOptional: boolean,
  suggestedName?: string,
): string {
  const isRequired = isOptional ? '' : '!'
  const type = types.concretise(t)
  let name: string | undefined = type.options?.name ?? suggestedName
  const description = type.options && 'description' in type.options ? type.options.description : undefined

  if (type.kind === types.Kind.String) {
    return `String${isRequired}`
  }
  if (type.kind === types.Kind.Custom) {
    const gqlType: GraphqlType = { type: 'scalar', description, impl: type }
    typeMap[type.typeName] = gqlType
    return `${type.typeName}${isRequired}`
  }
  if (type.kind === types.Kind.Boolean) {
    return `Boolean${isRequired}`
  }
  if (type.kind === types.Kind.Number) {
    if (type.options?.isInteger) {
      return `Int${isRequired}`
    }
    return `Float${isRequired}`
  }
  if (type.kind === types.Kind.Array) {
    return `[${typeToGqlType(type.wrappedType, typeMap, typeRef, isInput, false, name)}]${isRequired}`
  }
  if (type.kind === types.Kind.Optional || type.kind === types.Kind.Nullable) {
    return typeToGqlType(type.wrappedType, typeMap, typeRef, isInput, true, name)
  }
  if (type.kind === types.Kind.Object) {
    name = name ?? 'NAME_NEEDED'
    const fields = Object.entries(type.fields as types.Fields).map(([fieldName, field]) => {
      const fieldMType = types.concretise(types.unwrapField(field))
      const fieldType = typeToGqlType(field as types.Type, typeMap, typeRef, isInput, false, `${name}_${fieldName}`)
      const desc = fieldMType.options?.description ? `"""${fieldMType.options.description}"""\n` : ''
      return `${desc}${fieldName}: ${fieldType}`
    })
    if (isInput) {
      typeMap[`I${name}`] = {
        type: 'input',
        description,
        definition: `input I${name} {
          ${fields.join('\n        ')}
      }`,
      }
    } else {
      typeMap[name] = {
        type: 'type',
        description,
        definition: `type ${name} {
        ${fields.join('\n        ')}
    }`,
      }
    }

    return `${isInput ? 'I' : ''}${name}${isRequired}`
  }
  if (type.kind === types.Kind.Enum) {
    name = name ?? 'NAME_NEEDED'
    typeMap[name] = {
      type: 'enum',
      description,
      definition: `enum ${name} {
      ${type.variants.join('\n        ')}
    }`,
    }
    return `${name}${isRequired}`
  }
  if (type.kind === types.Kind.Union) {
    name = name ?? 'NAME_NEEDED'
    const ts = Object.entries(type.variants)
    //If input use @oneOf https://github.com/graphql/graphql-spec/pull/825
    if (isInput) {
      const fields = ts.flatMap(([unionName, fieldT]) => {
        const fieldType = typeToGqlType(fieldT as types.Type, typeMap, typeRef, isInput, false, unionName)
        const realType =
          fieldType.charAt(fieldType.length - 1) === '!' ? fieldType.substring(0, fieldType.length - 1) : fieldType
        return [`${unionName}: ${realType}`]
      })
      typeMap[`I${name}`] = {
        type: 'input',
        description,
        definition: `input I${name} {
          ${fields.join('\n        ')}
      }`,
      }
      return `I${name}${isRequired}`
    }

    typeMap[name] = {
      type: 'union',
      description,
      definition: `union ${name} = ${ts
        .map(([k, t], i) => typeToGqlType(t as types.Type, typeMap, typeRef, isInput, true, k))
        .join(' | ')}`,
      is: Object.fromEntries(ts.map(([k]) => [k, (v) => (v as Record<string, unknown>)[`__variant_${k}`] === true])),
    }
    return `${name}${isRequired}`
  }
  if (type.kind === types.Kind.Literal) {
    const t = typeof type.literalValue
    const tp = t === 'boolean' ? 'Boolean' : t === 'number' ? 'Float' : t === 'string' ? 'String' : null
    if (type.literalValue === null) {
      typeMap['Null'] = {
        type: 'scalar',
        impl: types.custom(
          'null',
          () => null,
          () => decoding.succeed(null),
          (input) => {
            if (input === null) {
              return validation.succeed()
            }
            return validation.fail('Expected null', input)
          },
        ),
      }
      return 'Null'
    }
    if (tp === null) {
      throw new Error(`Unknown literal type: ${tp}`)
    }
    return `${tp}${isRequired}`
  }
  return assertNever(type)
}

function generateTypes<Fs extends functions.Functions>({
  module,
}: {
  module: module.Module<Fs, any>
}): {
  typeMap: Record<string, GraphqlType>
  inputTypeMap: Record<string, GraphqlType>
} {
  const typeMap: Record<string, GraphqlType> = {}
  const typeRef: Map<Function, string> = new Map()
  const usedTypes: types.Type[] = []
  for (const functionBody of Object.values(module.functions)) {
    usedTypes.push(functionBody.output)
  }
  for (const type of usedTypes) {
    typeToGqlType(type, typeMap, typeRef, false, false)
  }
  const inputTypeMap: Record<string, GraphqlType> = {}
  const inputTypeRef: Map<Function, string> = new Map()
  const usedInputs: types.Type[] = []
  for (const functionBody of Object.values(module.functions)) {
    usedInputs.push(functionBody.input)
  }
  for (const type of usedInputs) {
    typeToGqlType(type, inputTypeMap, inputTypeRef, true, false)
  }
  return { typeMap, inputTypeMap }
}

function generateScalars({ typeMap }: { typeMap: Record<string, GraphqlType> }) {
  const scalarDefs = Object.entries(typeMap)
    .flatMap(([id, s]) =>
      s.type === 'scalar' ? [s.description ? `"""${s.description}"""\nscalar ${id}` : `scalar ${id}`] : [],
    )
    .join('\n')
  const scalarResolvers = Object.fromEntries(
    Object.entries(typeMap)
      .filter(([id, s]) => s.type === 'scalar')
      .map(([id, s]) => {
        return [
          id,
          new GraphQLScalarType({
            name: id,
            description: s.description,
            serialize(input) {
              return input
            },
            parseValue(input) {
              return input
            },
          }),
        ] as const
      }),
  )
  return { scalarDefs, scalarResolvers }
}

function generateQueryOrMutation<const ServerContext, const Fs extends functions.Functions, const ContextInput>({
  module,
  type,
  api,
  context,
  setHeader,
  error,
}: {
  type: 'query' | 'mutation'
  module: module.Module<Fs, ContextInput>
  api: Api<Fs>
  context: (server: ServerContext, info: GraphQLResolveInfo) => Promise<ContextInput>
  setHeader: (server: ServerContext, name: string, value: string) => void
  error?: ErrorHandler<Fs, ServerContext>
}) {
  const resolvers = Object.fromEntries(
    Object.entries(module.functions).flatMap(([functionName, functionBody]) => {
      const partialOutputType = types.partialDeep(functionBody.output)
      const specifications = api.functions[functionName]
      if (!specifications) {
        return []
      }
      if (
        (isArray(specifications) && !specifications.some((s) => s.type === type)) ||
        (!isArray(specifications) && specifications.type !== type)
      ) {
        return []
      }
      return (isArray(specifications) ? specifications : [specifications]).flatMap((specification) => {
        if (specification.type !== type) {
          return []
        }
        const gqlInputTypeName = specification.inputName ?? 'input'

        const resolver = async (
          parent: unknown,
          input: Record<string, unknown>,
          serverContext: ServerContext,
          info: GraphQLResolveInfo,
        ) => {
          const operationId = utils.randomOperationId()
          const operationLogger = logger.build({
            moduleName: module.name,
            operationId,
            operationType: specification.type,
            operationName: specification.name ?? functionName,
            server: 'GQL',
          })
          setHeader(serverContext, 'operation-id', operationId)
          const decoded = types.concretise(functionBody.input).decode(input[gqlInputTypeName], {
            typeCastingStrategy: 'tryCasting',
          })
          if (!decoded.isOk) {
            operationLogger.logError('Bad request.')
            throw createGraphQLError(`Invalid input.`, { extensions: decoded.error })
          }
          const gqlProjection = infoToProjection(info, functionBody.output)
          const proj = projection.decode(functionBody.output, gqlProjection, { typeCastingStrategy: 'tryCasting' })
          if (!proj.isOk) {
            operationLogger.logError('Bad request. (projection)')
            throw createGraphQLError(`Invalid input.`, { extensions: proj.error })
          }

          const contextInput = await context(serverContext, info)
          const moduleCtx = await module.context(contextInput, {
            projection: proj.value,
            input: decoded.value,
            operationId,
            logger: operationLogger,
          })
          try {
            const result = await functionBody.apply({
              context: moduleCtx,
              projection: proj.value,
              input: decoded.value as never,
              operationId,
              logger: operationLogger,
            })
            if (!result.isOk) {
              throw new Error(result.error)
            }
            const encoded = types.concretise(partialOutputType).encodeWithoutValidation(result.value)
            //TODO: if union remove tag and set `__variant_${tag}`: true
            operationLogger.logInfo('Completed.')
            return encoded
          } catch (e) {
            operationLogger.logError('Failed with exception.')
            if (error) {
              const result = await error({
                error: e,
                log: operationLogger,
                functionName,
                operationId,
                context: moduleCtx,
                functionArgs: {
                  projection: proj.value,
                  input: decoded.value,
                },
                ...serverContext,
              })
              if (result) {
                throw createGraphQLError(result.message, result.options)
              }
            }
            throw e
          }
        }
        return [[specification.name ?? functionName, resolver]]
      })
    }),
  )

  const namespaces: Record<string, string[]> = {}
  const defs = Object.entries(module.functions)
    .flatMap(([functionName, functionBody]) => {
      const specifications = api.functions[functionName]
      if (!specifications) {
        return []
      }
      if (
        (isArray(specifications) && !specifications.some((s) => s.type === type)) ||
        (!isArray(specifications) && specifications.type !== type)
      ) {
        return []
      }
      return (isArray(specifications) ? specifications : [specifications]).flatMap((specification) => {
        const namespace =
          specification.namespace !== null ? functionBody.options?.namespace ?? specification.namespace : null
        if (namespace) {
          if (namespaces[namespace]) {
            namespaces[namespace].push(specification.name ?? functionName)
          } else {
            namespaces[namespace] = [specification.name ?? functionName]
          }
        }
        const inputIsVoid = false
        const gqlInputType = inputIsVoid ? null : typeToGqlType(functionBody.input, {}, new Map(), true, false)
        const gqlOutputType = typeToGqlType(functionBody.output, {}, new Map(), false, false)
        const description = functionBody.options?.description ? `"""${functionBody.options?.description}"""\n` : null
        const def = inputIsVoid
          ? `${specification.name ?? functionName}: ${gqlOutputType}`
          : `${specification.name ?? functionName}(${
              specification.inputName ?? 'input'
            }: ${gqlInputType}): ${gqlOutputType}`
        const operationType = type === 'query' ? 'Query' : 'Mutation'
        if (namespace) {
          return [
            `type ${operationType} {`,
            `${namespace}: ${namespace}${operationType}!`,
            '}',
            `type ${namespace}${operationType} {`,
            description,
            def,
            '}',
          ]
        }
        return [`type ${operationType} {`, description, def, '}']
      })
    })
    .filter((v) => v != null)
    .join('\n')

  const namespacesResolvers = Object.fromEntries(
    Object.entries(namespaces).map(([namespace, resolverNames]) => [
      `${namespace}${type === 'query' ? 'Query' : 'Mutation'}`,
      Object.fromEntries(
        resolverNames.map((resolverName) => {
          const result = [resolverName, resolvers[resolverName]]
          delete resolvers[resolverName]
          return result
        }),
      ),
    ]),
  )
  const otherResolvers = Object.fromEntries(Object.keys(namespaces).map((namespace) => [namespace, () => ({})]))
  return { defs, resolvers: { ...resolvers, ...otherResolvers }, namespacesResolvers }
}

export function fromModule<const ServerContext, const Fs extends functions.Functions, const ContextInput>({
  module,
  api,
  context,
  setHeader,
  error,
}: {
  module: module.Module<Fs, ContextInput>
  api: Api<Fs>
  context: (server: ServerContext, info: GraphQLResolveInfo) => Promise<ContextInput>
  setHeader: (server: ServerContext, name: string, value: string) => void
  error?: ErrorHandler<Fs, ServerContext>
}): GraphQLSchema {
  const {
    defs: queryDefs,
    resolvers: queryResolvers,
    namespacesResolvers: queryNamespacesResolvers,
  } = generateQueryOrMutation({
    module,
    api,
    type: 'query',
    context,
    setHeader,
    error,
  })
  const {
    defs: mutationDefs,
    resolvers: mutationResolvers,
    namespacesResolvers: mutationNamespacesResolvers,
  } = generateQueryOrMutation({
    module,
    api,
    type: 'mutation',
    context,
    setHeader,
    error,
  })
  const { typeMap, inputTypeMap } = generateTypes({ module })
  const { scalarDefs, scalarResolvers } = generateScalars({ typeMap: { ...typeMap, ...inputTypeMap } })

  const typeDefs = Object.entries(typeMap)
    .flatMap(([id, t]) => {
      if (t.type === 'enum' || t.type === 'type' || t.type === 'union') {
        return [t.definition]
      }
      return []
    })
    .join('\n')

  const inputDefs = Object.entries(inputTypeMap)
    .flatMap(([id, t]) => {
      if (t.type === 'input') {
        return [t.definition]
      }
      return []
    })
    .join('\n')

  const unions = Object.fromEntries(
    Object.entries(typeMap).flatMap(([id, t]) => {
      if (t.type === 'union' && t.is) {
        return Object.entries(t.is)
      }
      return []
    }),
  )

  const schemaDefs = `
  ${scalarDefs}
  ${typeDefs}
  ${inputDefs}
  ${queryDefs}
  ${mutationDefs}
  `
  const unionResolvers = Object.fromEntries(Object.entries(unions).map(([k, v]) => [k, { __isTypeOf: v }]))
  try {
    const schema = makeExecutableSchema({
      typeDefs: schemaDefs,
      resolvers: {
        ...(Object.keys(queryResolvers).length > 0 ? { Query: queryResolvers } : {}),
        ...(Object.keys(mutationResolvers).length > 0 ? { Mutation: mutationResolvers } : {}),
        ...scalarResolvers,
        ...unionResolvers,
        ...queryNamespacesResolvers,
        ...mutationNamespacesResolvers,
      },
    })

    return schema
  } catch (error) {
    console.log(schemaDefs)
    throw error
  }
}
*/
