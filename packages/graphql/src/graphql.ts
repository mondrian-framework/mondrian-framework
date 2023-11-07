import { FunctionSpecifications, Api, ErrorHandler } from './api'
import { createGraphQLError } from '@graphql-tools/utils'
import { result, retrieve, types } from '@mondrian-framework/model'
import { GenericRetrieve } from '@mondrian-framework/model/src/retrieve'
import { functions, logger, logger as logging, module, utils } from '@mondrian-framework/module'
import { MondrianLogger } from '@mondrian-framework/module/src/logger'
import { groupBy } from '@mondrian-framework/utils'
import { JSONType, capitalise, isArray, mapObject, toCamelCase } from '@mondrian-framework/utils'
import fs from 'fs'
import {
  GraphQLScalarType,
  GraphQLObjectType,
  GraphQLEnumType,
  GraphQLString,
  GraphQLList,
  GraphQLNonNull,
  GraphQLBoolean,
  getNullableType,
  GraphQLUnionType,
  GraphQLOutputType,
  GraphQLSchema,
  GraphQLResolveInfo,
  GraphQLFieldConfig,
  GraphQLInputObjectType,
  GraphQLInputType,
  GraphQLFloat,
  GraphQLInputFieldConfig,
  printSchema,
  GraphQLFieldConfigArgumentMap,
  GraphQLInt,
  isOutputType,
  isInputType,
  SelectionNode,
  Kind,
  valueFromASTUntyped,
} from 'graphql'

/**
 * Generates a name for the given type with the following algorithm:
 * - If the type has a name uses that, otherwise
 * - If the default name is defined uses that, otherwise
 * - Generates a random name in the form "TYPE{N}" where "N" is a random integer
 */
function generateName(type: types.Type, internalData: InternalData): string {
  const concreteType = types.concretise(type)
  const name = concreteType.options?.name
    ? capitalise(concreteType.options.name)
    : internalData.defaultName ?? `ANONYMPUS_TYPE_${internalData.usedNames.size}`
  return checkNameOccurencies(name, internalData)
}

/**
 * Same as {@link generateName} but this happens 'Input' at the type name if not already present.
 */
function generateInputName(type: types.Type, internalData: InternalData): string {
  const concreteType = types.concretise(type)
  const name = concreteType.options?.name
    ? capitalise(concreteType.options.name)
    : internalData.defaultName ?? `ANONYMPUS_TYPE_${internalData.usedNames.size}`
  if (name.toLocaleLowerCase().endsWith('input')) {
    const result = name.slice(0, name.length - 5)
    return checkNameOccurencies(`${result}Input`, internalData)
  } else {
    return checkNameOccurencies(`${name}Input`, internalData)
  }
}

/**
 * Checks if the name is not already taken. If it's a duplicate it will be transformed by adding a number at the end.
 */
function checkNameOccurencies(name: string, internalData: InternalData): string {
  const usedOccurencies = internalData.usedNames.get(name)
  if (usedOccurencies) {
    console.warn(`[GRAPHQL-GENERATION] '${name}' symbol is used multiple times.`)
    internalData.usedNames.set(name, usedOccurencies + 1)
    return `${name}${usedOccurencies}`
  } else {
    internalData.usedNames.set(name, 1)
    return name
  }
}

// Data used in the recursive calls of `typeToGraphQLTypeInternal` to store
// all relevant information that has to be used throughout the recursive calls.
type InternalData = {
  // A map from <explored type> to already generated output type(s)
  readonly knownOutputTypes: Map<types.Type, GraphQLOutputType>
  // A map from <explored type> to already generated input type(s)
  readonly knownInputTypes: Map<types.Type, GraphQLInputType>
  // A map for all custom types that have already been explored. Here we just
  // save their name
  readonly knownCustomTypes: Map<string, GraphQLScalarType>
  // map of used names and it's occurencies. Normally should always be { name -> 1 }.
  //if some values are greater than 1 a collision occur.
  readonly usedNames: Map<string, number>
  // The default name to assign to the current type in the iteration process
  readonly defaultName: string | undefined
}

function typeToGraphQLOutputType(type: types.Type, internalData: InternalData): GraphQLOutputType {
  const knownOutputType = internalData.knownOutputTypes.get(type)
  if (knownOutputType) {
    return knownOutputType
  }
  const graphQLType = types.match(type, {
    number: (type) => scalarOrDefault(type, type.options?.isInteger ? GraphQLInt : GraphQLFloat, internalData),
    string: (type) => scalarOrDefault(type, GraphQLString, internalData),
    boolean: (type) => scalarOrDefault(type, GraphQLBoolean, internalData),
    literal: (type) => literalToGraphQLType(type, internalData),
    enum: (type) => enumToGraphQLType(type, internalData),
    custom: (type) => customTypeToGraphQLType(type, internalData),
    union: (type) => unionToGraphQLType(type, internalData),
    object: (type) => objectToGraphQLType(type, internalData),
    entity: (type) => entityToGraphQLType(type, internalData),
    array: (type) => arrayToGraphQLType(type, internalData),
    wrapper: ({ wrappedType }) => getNullableType(typeToGraphQLOutputType(wrappedType, internalData)),
  })
  setKnownType(type, graphQLType, internalData)
  return graphQLType
}

function typeToGraphQLInputType(type: types.Type, internalData: InternalData): GraphQLInputType {
  const knownInputType = internalData.knownInputTypes.get(type)
  if (knownInputType) {
    return knownInputType
  }
  const graphQLType: GraphQLInputType = types.match(type, {
    number: (type) => scalarOrDefault(type, type.options?.isInteger ? GraphQLInt : GraphQLFloat, internalData),
    string: (type) => scalarOrDefault(type, GraphQLString, internalData),
    boolean: (type) => scalarOrDefault(type, GraphQLBoolean, internalData),
    literal: (type) => literalToGraphQLType(type, internalData),
    enum: (type) => enumToGraphQLType(type, internalData),
    custom: (type) => customTypeToGraphQLType(type, internalData),
    union: (type) => unionToInputGraphQLType(type, internalData),
    object: (type) => objectToInputGraphQLType(type, internalData),
    entity: (type) => entityToInputGraphQLType(type, internalData),
    array: (type) => arrayToInputGraphQLType(type, internalData),
    wrapper: ({ wrappedType }) => getNullableType(typeToGraphQLInputType(wrappedType, internalData)),
  })
  setKnownType(type, graphQLType, internalData)
  return graphQLType
}

function setKnownType(
  type: types.Type,
  graphqlType: GraphQLOutputType | GraphQLInputType,
  internalData: InternalData,
): void {
  if (isOutputType(graphqlType)) {
    internalData.knownOutputTypes.set(type, graphqlType)
  }
  if (isInputType(graphqlType)) {
    internalData.knownInputTypes.set(type, graphqlType)
  }
}

// If the given type has a name then it is turned into a scalar
// If the type doesn't have any name then this function returns the provided
// default type
function scalarOrDefault(
  type: types.Type,
  defaultType: GraphQLScalarType,
  internalData: InternalData,
): GraphQLScalarType {
  const concreteType = types.concretise(type)
  const hasName = concreteType.options?.name != null
  return !hasName ? defaultType : scalarFromType(type, internalData)
}

// Turns a type into a GraphQL scalar type
function scalarFromType(type: types.Type, internalData: InternalData): GraphQLScalarType<unknown, JSONType> {
  const concreteType = types.concretise(type)
  const name = generateName(type, internalData)
  // TODO: add parseValue and parseLiteral and serialize?
  return new GraphQLScalarType({ name, description: concreteType.options?.description })
}

function enumToGraphQLType(
  enumeration: types.EnumType<readonly [string, ...string[]]>,
  internalData: InternalData,
): GraphQLEnumType {
  const name = generateName(enumeration, internalData)
  const variants = enumeration.variants.map((variant) => [variant, { value: variant }])
  const values = Object.fromEntries(variants)
  return new GraphQLEnumType({ name, values })
}

// Turns a literal into a GraphQL scalar.
function literalToGraphQLType(
  literal: types.LiteralType<number | string | null | boolean>,
  internalData: InternalData,
): GraphQLScalarType {
  //Set a default description and a default name
  const mappedLiteral = literal.setOptions({
    ...literal.options,
    description:
      literal.options?.description ??
      `Literal value of type ${
        typeof literal.literalValue === 'object' ? 'null' : typeof literal.literalValue
      }. Value: ${literal.literalValue}`,
    name: literal.options?.name,
  })
  return scalarFromType(mappedLiteral, internalData)
}

function arrayToGraphQLType(
  array: types.ArrayType<any, any>,
  internalData: InternalData,
): GraphQLList<GraphQLOutputType> {
  const arrayName = generateName(array, internalData)
  const itemDefaultName = arrayName + 'Item'
  const itemsType = typeToGraphQLOutputType(array.wrappedType, {
    ...internalData,
    defaultName: itemDefaultName,
  })
  const wrappedType = types.isOptional(array.wrappedType) ? itemsType : new GraphQLNonNull(itemsType)
  return new GraphQLList(wrappedType)
}

function arrayToInputGraphQLType(
  array: types.ArrayType<any, any>,
  internalData: InternalData,
): GraphQLList<GraphQLInputType> {
  const arrayName = generateInputName(array, internalData)
  const itemDefaultName = arrayName + 'Item'
  const itemsType = typeToGraphQLInputType(array.wrappedType, {
    ...internalData,
    defaultName: itemDefaultName,
  })
  const wrappedType = types.isOptional(array.wrappedType) ? itemsType : new GraphQLNonNull(itemsType)
  return new GraphQLList(wrappedType)
}

function objectToGraphQLType(
  object: types.ObjectType<any, types.Types>,
  internalData: InternalData,
): GraphQLObjectType {
  const objectName = generateName(object, internalData)
  const fields = () =>
    mapObject(object.fields, typeToGraphQLObjectField({ ...internalData, defaultName: undefined }, objectName))
  return new GraphQLObjectType({ name: objectName, fields, description: object.options?.description })
}

function objectToInputGraphQLType(
  object: types.ObjectType<any, types.Types>,
  internalData: InternalData,
): GraphQLInputObjectType {
  const objectName = generateInputName(object, internalData)
  const fields = () =>
    mapObject(object.fields, typeToGraphQLInputObjectField({ ...internalData, defaultName: undefined }, objectName))
  return new GraphQLInputObjectType({ name: objectName, fields, description: object.options?.description })
}

function entityToGraphQLType(
  entity: types.EntityType<any, types.Types>,
  internalData: InternalData,
): GraphQLObjectType {
  const objectName = generateName(entity, internalData)
  const fields = () =>
    mapObject(entity.fields, typeToGraphQLObjectField({ ...internalData, defaultName: undefined }, objectName))
  return new GraphQLObjectType({ name: objectName, fields, description: entity.options?.description })
}

function entityToInputGraphQLType(
  entity: types.EntityType<any, types.Types>,
  internalData: InternalData,
): GraphQLInputObjectType {
  const objectName = generateInputName(entity, internalData)
  const fields = () =>
    mapObject(entity.fields, typeToGraphQLInputObjectField({ ...internalData, defaultName: undefined }, objectName))
  return new GraphQLInputObjectType({ name: objectName, fields, description: entity.options?.description })
}

function typeToGraphQLObjectField(
  internalData: InternalData,
  objectName: string,
): (fieldName: string, fieldType: types.Type) => GraphQLFieldConfig<any, any> {
  return (fieldName, fieldType) => {
    const fieldDefaultName = generateName(fieldType, {
      ...internalData,
      defaultName: objectName + capitalise(fieldName),
      usedNames: new Map(), //because we are not using it now, it's only potentially used
    })
    const graphQLType = typeToGraphQLOutputType(fieldType, {
      ...internalData,
      defaultName: fieldDefaultName,
    })
    const canBeMissing = types.isOptional(fieldType) || types.isNullable(fieldType)
    const unwrappedFieldType = types.unwrap(fieldType)
    const canBeRetrieved = unwrappedFieldType.kind === types.Kind.Entity && types.isArray(fieldType)
    let graphqlRetrieveArgs: GraphQLFieldConfigArgumentMap | undefined = undefined
    if (canBeRetrieved) {
      const retrieveType = retrieve.fromType(fieldType, { where: true, skip: true, take: true, orderBy: true })
      if (retrieveType.isOk) {
        graphqlRetrieveArgs = retrieveTypeToGraphqlArgs(retrieveType.value, internalData, {
          where: true,
          skip: true,
          take: true,
          orderBy: true,
        })
      }
    }
    return {
      type: canBeMissing ? graphQLType : new GraphQLNonNull(graphQLType),
      args: graphqlRetrieveArgs,
    }
  }
}

function retrieveTypeToGraphqlArgs(
  retrieveType: types.ObjectType<types.Mutability.Immutable, types.Types>,
  internalData: InternalData,
  capabilities: retrieve.Capabilities,
): GraphQLFieldConfigArgumentMap {
  const whereType = () => typeToGraphQLInputType(retrieveType.fields['where'], internalData)
  const orderByType = () => typeToGraphQLInputType(retrieveType.fields['orderBy'], internalData)
  const takeType = () => typeToGraphQLInputType(retrieveType.fields['take'], internalData)
  const skipType = () => typeToGraphQLInputType(retrieveType.fields['skip'], internalData)
  return {
    ...(capabilities.where ? { where: { type: whereType() } } : {}),
    ...(capabilities.orderBy ? { orderBy: { type: orderByType() } } : {}),
    ...(capabilities.take ? { take: { type: takeType() } } : {}),
    ...(capabilities.skip ? { skip: { type: skipType() } } : {}),
  }
}

function typeToGraphQLInputObjectField(
  internalData: InternalData,
  objectName: string,
): (fieldName: string, fieldType: types.Type) => GraphQLInputFieldConfig {
  return (fieldName, fieldType) => {
    const fieldDefaultName = generateInputName(fieldType, {
      ...internalData,
      defaultName: objectName + capitalise(fieldName),
      usedNames: new Map(), //because we are not using it now, it's only potentially used
    })
    const graphQLType = typeToGraphQLInputType(fieldType, {
      ...internalData,
      defaultName: fieldDefaultName,
    })
    const canBeMissing = types.isOptional(fieldType) || types.isNullable(fieldType)
    return { type: canBeMissing ? graphQLType : new GraphQLNonNull(graphQLType) }
  }
}

function unionToGraphQLType(union: types.UnionType<types.Types>, internalData: InternalData): GraphQLUnionType {
  const unionName = generateName(union, internalData)
  const unionTypes = Object.entries(union.variants).map(([name, variantType]) => {
    const variantName = unionName + capitalise(name)
    const value = typeToGraphQLOutputType(variantType, {
      ...internalData,
      defaultName: variantName,
    })
    if (value instanceof GraphQLObjectType) {
      return value
    } else {
      throw new Error(
        `[GRAPHQL-GENERATION] Cannot generate GraphQL union with non-object variants. Union ${unionName}, Variant ${variantName}`,
      )
    }
  })
  return new GraphQLUnionType({
    name: unionName,
    types: unionTypes,
    resolveType: (value) => {
      const i = Object.keys(union.variants).findIndex((variantName) => {
        return variantName === types.partialDeep(union).variantOwnership(value as never)
      })
      return unionTypes[i].name
    },
  })
}

function unionToInputGraphQLType(
  union: types.UnionType<types.Types>,
  internalData: InternalData,
): GraphQLInputObjectType {
  const unionName = generateInputName(union, internalData)
  const fields = () =>
    mapObject(union.variants, typeToGraphQLInputUnionVariant({ ...internalData, defaultName: undefined }, unionName))
  return new GraphQLInputObjectType({ name: unionName, fields })
}

function typeToGraphQLInputUnionVariant(
  internalData: InternalData,
  unionName: string,
): (fieldName: string, fieldType: types.Type) => GraphQLInputFieldConfig {
  return (fieldName, fieldType) => {
    const fieldDefaultName = generateInputName(fieldType, {
      ...internalData,
      defaultName: unionName + capitalise(fieldName),
      usedNames: new Map(), //because we are not using it now, it's only potentially used
    })
    const graphQLType = typeToGraphQLInputType(fieldType, {
      ...internalData,
      defaultName: fieldDefaultName,
    })
    return { type: new GraphQLNonNull(graphQLType) }
  }
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
    const scalar = scalarFromType(type, {
      ...internalData,
      defaultName: capitalise(type.typeName),
    })
    knownCustomTypes.set(type.typeName, scalar)
    return scalar
  }
}

export type FromModuleInput<ServerContext, Fs extends functions.Functions, ContextInput> = {
  module: module.Module<Fs, ContextInput>
  api: Api<Fs>
  context: (context: ServerContext, info: GraphQLResolveInfo) => Promise<ContextInput>
  setHeader: (context: ServerContext, name: string, value: string) => void
  errorHandler?: ErrorHandler<Fs, ContextInput>
}

/**
 * Creates a new `GraphQLSchema` from the given module.
 * Each function appearing in the module's API is either turned into a query or a mutation according to the
 * provided specification.
 */
export function fromModule<const ServerContext, const Fs extends functions.Functions, const ContextInput>(
  input: FromModuleInput<ServerContext, Fs, ContextInput>,
): GraphQLSchema {
  const { module, api, context, setHeader, errorHandler } = input
  const moduleFunctions = Object.entries(module.functions)
  const internalData: InternalData = {
    knownOutputTypes: new Map(),
    knownInputTypes: new Map(),
    knownCustomTypes: new Map(),
    defaultName: undefined,
    usedNames: new Map(),
  }
  const queriesArray = moduleFunctions.map(([functionName, functionBody]) => ({
    namespace: functionBody.options?.namespace ?? '',
    fields: toQueries(
      module.name,
      functionName,
      functionBody,
      api.functions[functionName],
      setHeader,
      context,
      module.context,
      errorHandler,
      internalData,
    ),
  }))
  const queries = splitIntoNamespaces(queriesArray, 'Query')
  const mutationsArray = moduleFunctions.map(([functionName, functionBody]) => ({
    namespace: functionBody.options?.namespace ?? '',
    fields: toMutations(
      module.name,
      functionName,
      functionBody,
      api.functions[functionName],
      setHeader,
      context,
      module.context,
      errorHandler,
      internalData,
    ),
  }))
  const mutations = splitIntoNamespaces(mutationsArray, 'Mutation')
  const query =
    queries.length === 0 ? undefined : new GraphQLObjectType({ name: 'Query', fields: Object.fromEntries(queries) })
  const mutation =
    queries.length === 0
      ? undefined
      : new GraphQLObjectType({ name: 'Mutation', fields: Object.fromEntries(mutations) })

  const schema = new GraphQLSchema({ query, mutation })
  const schemaPrinted = printSchema(schema)
  fs.writeFileSync('schema.graphql', schemaPrinted, {})
  return schema
}

function splitIntoNamespaces(
  operations: {
    namespace: string
    fields: [string, GraphQLFieldConfig<any, any, any>][]
  }[],
  type: 'Mutation' | 'Query',
): [string, GraphQLFieldConfig<any, any, any>][] {
  const mutationsMap = groupBy(operations, (v) => v.namespace)
  const splittedOperations: [string, GraphQLFieldConfig<any, any, any>][] = Object.entries(mutationsMap).flatMap(
    ([namespace, mutations]) => {
      const fields = mutations.flatMap((v) => v.fields)
      if (fields.length === 0) {
        return []
      }
      if (namespace === '') {
        return fields
      }
      return [
        [
          namespace,
          {
            type: new GraphQLObjectType({
              name: `${capitalise(namespace)}${type}Namespace`,
              fields: Object.fromEntries(fields),
            }),
            resolve: () => ({}),
          },
        ],
      ]
    },
  )
  return splittedOperations
}

/**
 * Turns a function into the list of queries defined by its specification(s).
 * Each query is tagged by its name as defined by the specification.
 */
function toQueries<const ServerContext, const ContextInput>(
  moduleName: string,
  functionName: string,
  fun: functions.FunctionImplementation,
  spec: FunctionSpecifications | readonly FunctionSpecifications[] | undefined,
  setHeader: (context: ServerContext, name: string, value: string) => void,
  getContextInput: (context: ServerContext, info: GraphQLResolveInfo) => Promise<ContextInput>,
  getModuleContext: (
    input: ContextInput,
    args: {
      input: unknown
      retrieve: retrieve.GenericRetrieve | undefined
      operationId: string
      logger: logger.MondrianLogger
    },
  ) => Promise<unknown>,
  errorHandler: ErrorHandler<functions.Functions, ContextInput> | undefined,
  internalData: InternalData,
): [string, GraphQLFieldConfig<any, any>][] {
  return (spec && isArray(spec) ? spec : spec ? [spec] : [])
    .filter((spec) => spec.type === 'query')
    .map((spec) => {
      const queryName = spec.name ?? functionName
      return makeOperation(
        'query',
        moduleName,
        queryName,
        fun,
        setHeader,
        getContextInput,
        getModuleContext,
        errorHandler,
        internalData,
      )
    })
}

/**
 * Turns a function into the list of mutations defined by its specification(s).
 * Each mutations is tagged by its name as defined by the specification.
 */
function toMutations<const ServerContext, const ContextInput>(
  moduleName: string,
  functionName: string,
  functionBody: functions.FunctionImplementation,
  spec: FunctionSpecifications | readonly FunctionSpecifications[] | undefined,
  setHeader: (context: ServerContext, name: string, value: string) => void,
  getContextInput: (context: ServerContext, info: GraphQLResolveInfo) => Promise<ContextInput>,
  getModuleContext: (
    input: ContextInput,
    args: {
      input: unknown
      retrieve: retrieve.GenericRetrieve | undefined
      operationId: string
      logger: logger.MondrianLogger
    },
  ) => Promise<unknown>,
  errorHandler: ErrorHandler<functions.Functions, ContextInput> | undefined,
  internalData: InternalData,
): [string, GraphQLFieldConfig<any, any>][] {
  return (spec && isArray(spec) ? spec : spec ? [spec] : [])
    .filter((spec) => spec.type === 'mutation')
    .map((spec) => {
      const mutationName = spec.name ?? functionName
      return makeOperation(
        'mutation',
        moduleName,
        mutationName,
        functionBody,
        setHeader,
        getContextInput,
        getModuleContext,
        errorHandler,
        internalData,
      )
    })
}

function decodeRetrieve(info: GraphQLResolveInfo, retrieveType: types.Type): GenericRetrieve {
  if (info.fieldNodes.length !== 1) {
    throw createGraphQLError(
      'Invalid field nodes count. Probably you are requesting the same query or mutation multiple times.',
    )
  }
  const node = info.fieldNodes[0]
  const retrieve = selectionNodeToRetrieve(node)
  const rawRetrieve = retrieve[node.name.value] as GenericRetrieve
  const result = types.concretise(retrieveType).decode(rawRetrieve)
  if (result.isOk) {
    return result.value
  } else {
    throw createGraphQLError('Failed to decode retrieve')
  }
}

function selectionNodeToRetrieve(info: SelectionNode): Exclude<retrieve.GenericSelect, null> {
  if (info.kind === Kind.FIELD) {
    const argumentEntries = info.arguments?.map((arg) => {
      const value = valueFromASTUntyped(arg.value)
      return [arg.name.value, value]
    })
    const args = argumentEntries ? Object.fromEntries(argumentEntries) : undefined
    const select = info.selectionSet?.selections
      .filter((n) => n.kind !== Kind.INLINE_FRAGMENT || !n.typeCondition?.name.value.includes('Failure')) //TODO: weak check
      .map(selectionNodeToRetrieve)
      .reduce((p, c) => ({ ...p, ...c }))
    if (!select) {
      return { [info.name.value]: true }
    }
    return { [info.name.value]: { select, where: args.where, orderBy: args.orderBy, take: args.take, skip: args.skip } }
  } else if (info.kind === Kind.INLINE_FRAGMENT) {
    const results = info.selectionSet.selections.map(selectionNodeToRetrieve)
    return results.reduce((p, c) => ({ ...p, ...c }))
  } else {
    throw new Error(`Invalid GraphQL field type: ${info.kind}`)
  }
}

/**
 * Creates a tuple with the operation name and a configuration for a resolver for the given operation.
 *
 * The operation is created according to the given function's input and output types.
 * `setHeader`, `getContextInput`, `getModuleContext` and `errorHanlder` are all functions that are
 * somehow needed by the resolver implementation.
 */
function makeOperation<const ServerContext, const ContextInput>(
  operationType: 'query' | 'mutation',
  moduleName: string,
  functionName: string,
  functionBody: functions.FunctionImplementation,
  setHeader: (context: ServerContext, name: string, value: string) => void,
  getContextInput: (context: ServerContext, info: GraphQLResolveInfo) => Promise<ContextInput>,
  getModuleContext: (
    input: ContextInput,
    args: {
      input: unknown
      retrieve: retrieve.GenericRetrieve | undefined
      operationId: string
      logger: logger.MondrianLogger
    },
  ) => Promise<unknown>,
  errorHandler: ErrorHandler<functions.Functions, ContextInput> | undefined,
  internalData: InternalData,
): [string, GraphQLFieldConfig<any, any>] {
  const plainInput = typeToGraphQLInputType(functionBody.input, {
    ...internalData,
    defaultName: `${capitalise(functionName)}Input`,
  })
  const isInputNullable = types.isOptional(functionBody.input) || types.isNullable(functionBody.input)
  const input = { type: isInputNullable ? plainInput : new GraphQLNonNull(plainInput) }

  const { outputType, isOutputTypeWrapped } = getFunctionOutputTypeWithErrors(functionBody, functionName)
  const partialOutputType = types.concretise(types.partialDeep(outputType))
  const plainOutput = typeToGraphQLOutputType(outputType, {
    ...internalData,
    defaultName: `${capitalise(functionName)}Result`,
  })
  const isOutputNullable = types.isOptional(outputType) || types.isNullable(outputType)
  const output = isOutputNullable ? plainOutput : new GraphQLNonNull(plainOutput)

  const capabilities = functionBody.retrieve ?? {}
  delete functionBody.retrieve?.select
  const retrieveType = retrieve.fromType(functionBody.output, capabilities)
  const completeRetrieveType = retrieve.fromType(functionBody.output, { ...capabilities, select: true })

  //TODO: opentelemetry span
  const resolve = async (
    _: unknown,
    resolverInput: Record<string, unknown>,
    serverContext: ServerContext,
    info: GraphQLResolveInfo,
  ) => {
    // Setup logging
    const operationId = utils.randomOperationId()
    const logger = logging.build({ moduleName, operationId, operationType, operationName: functionName, server: 'GQL' })
    setHeader(serverContext, 'operation-id', operationId)

    // Decode all the needed bits to call the function
    const graphQLInputTypeName = 'input'
    const input = decodeInput(functionBody.input, resolverInput[graphQLInputTypeName], logger) as never
    const retrieveValue = completeRetrieveType.isOk ? decodeRetrieve(info, completeRetrieveType.value) : {}

    // Retrieve the contexts
    const contextInput = await getContextInput(serverContext, info)
    const context = await getModuleContext(contextInput, { retrieve: retrieveValue, input, operationId, logger })

    // Call the function and handle a possible failure
    try {
      const applyOutput = await functionBody.apply({
        context: context as Record<string, unknown>,
        retrieve: retrieveValue,
        input,
        operationId,
        logger,
      })
      let outputValue
      if (functionBody.errors) {
        const applyResult = applyOutput as result.Result<unknown, Record<string, unknown>>
        if (applyResult.isOk) {
          const v = isOutputTypeWrapped ? { value: applyResult.value } : applyResult.value
          outputValue = partialOutputType.encodeWithoutValidation(v as never)
        } else {
          outputValue = partialOutputType.encodeWithoutValidation(applyResult.error as never)
        }
      } else {
        outputValue = partialOutputType.encodeWithoutValidation(applyOutput as never)
      }
      logger.logInfo('Completed.')
      return outputValue
    } catch (error) {
      logger.logError('Failed.')
      if (errorHandler) {
        const result = await errorHandler({
          context,
          error,
          functionArgs: { retrieve: retrieveValue, input },
          functionName: functionName,
          log: logger,
          operationId,
          ...contextInput,
        })
        if (result) {
          throw createGraphQLError(result.message, result.options)
        }
      }
      if (error instanceof Error) {
        throw createGraphQLError(`Internal server error: ${error.message}`, { originalError: error })
      } else {
        throw createGraphQLError(`Internal server error.`)
      }
    }
  }

  if (retrieveType.isOk) {
    const graphqlRetrieveArgs = retrieveTypeToGraphqlArgs(retrieveType.value, internalData, capabilities)
    return [functionName, { type: output, args: { input, ...graphqlRetrieveArgs }, resolve }]
  } else {
    return [functionName, { type: output, args: { input }, resolve }]
  }
}

function getFunctionOutputTypeWithErrors(
  fun: functions.FunctionInterface,
  functionName: string,
): { outputType: types.Type; isOutputTypeWrapped: boolean } {
  if (!fun.errors) {
    return { outputType: fun.output, isOutputTypeWrapped: false }
  }
  const isOutputTypeWrapped = !types.isEntity(fun.output) && !types.isObject(fun.output)
  const success = isOutputTypeWrapped
    ? types.object({ value: fun.output }).setName(`${capitalise(functionName)}Success`)
    : fun.output
  const error = types
    .object(mapObject(fun.errors, (_, errorType) => types.optional(errorType)))
    .setName(`${capitalise(functionName)}Failure`)
  return {
    outputType: types.union({ error, success }).setName(`${capitalise(functionName)}Result`),
    isOutputTypeWrapped,
  }
}

/**
 * Tries to decode the given raw input, throwing a graphql error if the process fails.
 * A logger is needed to perform additional logging and keep track of the decoding result.
 */
function decodeInput(inputType: types.Type, rawInput: unknown, log: MondrianLogger) {
  const decoded = types.concretise(inputType).decode(rawInput, { typeCastingStrategy: 'tryCasting' })
  if (decoded.isOk) {
    log.logInfo('Input decoded')
    return decoded.value
  } else {
    log.logError('Bad request. (input)')
    throw createGraphQLError(`Invalid input.`, { extensions: decoded.error })
  }
}
