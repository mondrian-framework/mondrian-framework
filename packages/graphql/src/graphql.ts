import { FunctionSpecifications, Api, ErrorHandler } from './api'
import { createGraphQLError } from '@graphql-tools/utils'
import { result, retrieve, types } from '@mondrian-framework/model'
import { GenericRetrieve } from '@mondrian-framework/model/src/retrieve'
import { functions, logger as logging, module, utils } from '@mondrian-framework/module'
import { MondrianLogger } from '@mondrian-framework/module/src/logger'
import { JSONType, capitalise, mapObject, toCamelCase } from '@mondrian-framework/utils'
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
} from 'graphql'

/**
 * TODO: vedere se negli scalari da un suggerimento su cosa inserire (numero/stringa)
 *
 */

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
    : internalData.defaultName ?? 'TYPE' + Math.floor(Math.random() * 100_000_000)
  return checkNameOccurencies(name, internalData)
}

function generateInputName(type: types.Type, internalData: InternalData): string {
  const concreteType = types.concretise(type)
  const name = concreteType.options?.name
    ? capitalise(concreteType.options.name)
    : internalData.defaultName ?? 'TYPE' + Math.floor(Math.random() * 100_000_000)
  if (name.toLocaleLowerCase().endsWith('input')) {
    const result = name.slice(0, name.length - 5)
    return checkNameOccurencies(`${result}Input`, internalData)
  } else {
    return checkNameOccurencies(`${name}Input`, internalData)
  }
}

function checkNameOccurencies(name: string, internalData: InternalData): string {
  const usedOccurencies = internalData.usedNames.get(name)
  if (usedOccurencies) {
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

function typeToGraphQLOutputTypeInternal(type: types.Type, internalData: InternalData): GraphQLOutputType {
  const { knownOutputTypes } = internalData
  const knownOutputType = knownOutputTypes.get(type)
  if (knownOutputType) {
    return knownOutputType
  }
  const graphQLType = types.match(type, {
    number: (type) => scalarOrDefault(type, GraphQLFloat, internalData),
    string: (type) => scalarOrDefault(type, GraphQLString, internalData),
    boolean: (type) => scalarOrDefault(type, GraphQLBoolean, internalData),
    enum: (type) => enumToGraphQLType(type, internalData),
    literal: (type) => literalToGraphQLType(type, internalData),
    union: (type) => unionToGraphQLType(type, internalData),
    object: (type) => objectToGraphQLType(type, internalData),
    entity: (type) => entityToGraphQLType(type, internalData),
    array: (type) => arrayToGraphQLType(type, internalData),
    wrapper: ({ wrappedType }) => {
      const type = typeToGraphQLOutputTypeInternal(wrappedType, internalData)
      return getNullableType(type)
    },
    custom: (type) => customTypeToGraphQLType(type, internalData),
  })
  knownOutputTypes.set(type, graphQLType)
  return graphQLType
}

function typeToGraphQLInputTypeInternal(type: types.Type, internalData: InternalData): GraphQLInputType {
  const { knownInputTypes } = internalData
  const knownInputType = knownInputTypes.get(type)
  if (knownInputType) {
    return knownInputType
  }
  const graphQLType: GraphQLInputType = types.match(type, {
    number: () => GraphQLFloat,
    string: () => GraphQLString,
    boolean: () => GraphQLBoolean,
    enum: (_, type) => typeToGraphQLOutputTypeInternal(type, internalData) as GraphQLInputType,
    literal: (_, type) => typeToGraphQLOutputTypeInternal(type, internalData) as GraphQLInputType,
    union: ({ variants }) => {
      //TODO:
      return GraphQLFloat
    },
    object: (type) => objectToInputGraphQLType(type, internalData),
    entity: (type) => entityToInputGraphQLType(type, internalData),
    array: (type) => arrayToInputGraphQLType(type, internalData),
    wrapper: ({ wrappedType }) => getNullableType(typeToGraphQLInputTypeInternal(wrappedType, internalData)),
    custom: (type) => {
      //TODO: how to tell?
      return GraphQLString
    },
  })
  knownInputTypes.set(type, graphQLType)
  return graphQLType
}

// If the given type has some options then it is turned into a scalar (we assume
// that, since it has some options, it must be considered as a unique and distinct
// type from all others)
// If the type doesn't have any options then this function returns the provided
// default type
function scalarOrDefault<T extends types.Type>(
  type: T,
  defaultType: GraphQLOutputType,
  internalData: InternalData,
): GraphQLOutputType {
  const concreteType = types.concretise(type)
  const options = concreteType.options
  return !options ? defaultType : scalarFromType(concreteType, options.description, internalData)
}

// Turns a type into a GraphQL scalar type
function scalarFromType<T extends types.Type>(
  type: types.Concrete<T>,
  description: string | undefined,
  internalData: InternalData,
): GraphQLScalarType<types.Infer<T>, JSONType> {
  const name = generateName(type, internalData)
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
  // TODO: add parseValue and parseLiteral
  return new GraphQLScalarType<types.Infer<T>, JSONType>({ name, description, serialize })
}

function enumToGraphQLType(
  enumeration: types.EnumType<readonly [string, ...string[]]>,
  internalData: InternalData,
): GraphQLEnumType {
  const name = generateName(enumeration, internalData)
  const variants = enumeration.variants.map((variant, index) => [variant, { value: index }])
  const values = Object.fromEntries(variants)
  return new GraphQLEnumType({ name, values })
}

// Turns a literal into a GraphQL enum with a single value that represents the
// given literal value.
function literalToGraphQLType(
  literal: types.LiteralType<number | string | null | boolean>,
  internalData: InternalData,
): GraphQLEnumType {
  const name = generateName(literal, internalData)
  const rawLiteralName = literal.literalValue?.toString().trim() ?? 'null'
  const literalName = `Literal${toCamelCase(rawLiteralName)}`
  const values = Object.fromEntries([[literalName, { value: 0 }]])
  return new GraphQLEnumType({ name, values })
}

function arrayToGraphQLType(
  array: types.ArrayType<any, any>,
  internalData: InternalData,
): GraphQLList<GraphQLOutputType> {
  const arrayName = generateName(array, internalData)
  const itemDefaultName = arrayName + 'Item'
  const itemsType = typeToGraphQLOutputTypeInternal(array.wrappedType, {
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
  const itemsType = typeToGraphQLInputTypeInternal(array.wrappedType, {
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
  return new GraphQLObjectType({ name: objectName, fields })
}

function objectToInputGraphQLType(
  object: types.ObjectType<any, types.Types>,
  internalData: InternalData,
): GraphQLInputObjectType {
  const objectName = generateInputName(object, internalData)
  const fields = () =>
    mapObject(object.fields, typeToGraphQLInputObjectField({ ...internalData, defaultName: undefined }, objectName))
  return new GraphQLInputObjectType({ name: objectName, fields })
}

function entityToGraphQLType(
  object: types.EntityType<any, types.Types>,
  internalData: InternalData,
): GraphQLObjectType {
  const objectName = generateName(object, internalData)
  const fields = () =>
    mapObject(object.fields, typeToGraphQLObjectField({ ...internalData, defaultName: undefined }, objectName))
  return new GraphQLObjectType({ name: objectName, fields })
}

function entityToInputGraphQLType(
  object: types.EntityType<any, types.Types>,
  internalData: InternalData,
): GraphQLInputObjectType {
  const objectName = generateInputName(object, internalData)
  const fields = () =>
    mapObject(object.fields, typeToGraphQLInputObjectField({ ...internalData, defaultName: undefined }, objectName))
  return new GraphQLInputObjectType({ name: objectName, fields })
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
    const graphQLType = typeToGraphQLOutputTypeInternal(fieldType, {
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
  const whereType = () => typeToGraphQLInputTypeInternal(retrieveType.fields['where'], internalData)
  const orderByType = () => typeToGraphQLInputTypeInternal(retrieveType.fields['orderBy'], internalData)
  const takeType = () => typeToGraphQLInputTypeInternal(retrieveType.fields['take'], internalData)
  const skipType = () => typeToGraphQLInputTypeInternal(retrieveType.fields['skip'], internalData)
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
    const graphQLType = typeToGraphQLInputTypeInternal(fieldType, {
      ...internalData,
      defaultName: fieldDefaultName,
    })
    const canBeMissing = types.isOptional(fieldType) || types.isNullable(fieldType)
    return { type: canBeMissing ? graphQLType : new GraphQLNonNull(graphQLType) }
  }
}

function unionToGraphQLType(union: types.UnionType<types.Types>, internalData: InternalData): GraphQLUnionType {
  const unionName = generateName(union, internalData)
  const types = Object.entries(union.variants).map(([name, variantType]) => {
    const variantName = unionName + capitalise(name)
    const variantValueDefaultName = name + 'Value'
    const value = typeToGraphQLOutputTypeInternal(variantType, {
      ...internalData,
      defaultName: variantValueDefaultName,
    })
    const fields = Object.fromEntries([[name, { type: value }]])
    return new GraphQLObjectType({ name: variantName, fields })
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
    const scalar = scalarFromType(type, type.options?.description, {
      ...internalData,
      defaultName: capitalise(type.typeName),
    })
    knownCustomTypes.set(type.typeName, scalar)
    return scalar
  }
}

/**
 * TODO: add doc
 */
export type FromModuleInput<ServerContext, Fs extends functions.Functions, ContextInput> = {
  module: module.Module<Fs, ContextInput>
  api: Api<Fs>
  context: (server: ServerContext, info: GraphQLResolveInfo) => Promise<ContextInput>
  setHeader: (server: ServerContext, name: string, value: string) => void
  errorHandler?: ErrorHandler<Fs, ServerContext>
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
  const queriesArray = moduleFunctions.flatMap(([name, fun]) =>
    toQueries(
      module.name,
      name,
      fun,
      api.functions[name],
      setHeader,
      context,
      module.context,
      errorHandler,
      internalData,
    ),
  )
  const mutationsArray = moduleFunctions.flatMap(([name, fun]) =>
    toMutations(
      module.name,
      name,
      fun,
      api.functions[name],
      setHeader,
      context,
      module.context,
      errorHandler,
      internalData,
    ),
  )
  const query =
    queriesArray.length === 0
      ? undefined
      : new GraphQLObjectType({ name: 'Query', fields: Object.fromEntries(queriesArray) })
  const mutation =
    mutationsArray.length === 0
      ? undefined
      : new GraphQLObjectType({ name: 'Mutation', fields: Object.fromEntries(mutationsArray) })

  const schema = new GraphQLSchema({ query, mutation })
  const schemaPrinted = printSchema(schema)
  fs.writeFileSync('schema.graphql', schemaPrinted, {})
  return schema
}

/**
 * Turns a function into the list of queries defined by its specification(s).
 * Each query is tagged by its name as defined by the specification.
 */
function toQueries(
  moduleName: string,
  functionName: string,
  fun: functions.FunctionImplementation,
  spec: FunctionSpecifications | readonly FunctionSpecifications[] | undefined,
  setHeader: (server: any, name: string, value: string) => void,
  getContextInput: (server: any, info: GraphQLResolveInfo) => Promise<any>,
  getModuleContext: any,
  errorHandler: ErrorHandler<any, any> | undefined,
  internalData: InternalData,
): [string, GraphQLFieldConfig<any, any>][] {
  return asSpecs(spec)
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
function toMutations(
  moduleName: string,
  functionName: string,
  fun: functions.FunctionImplementation,
  spec: FunctionSpecifications | readonly FunctionSpecifications[] | undefined,
  setHeader: (server: any, name: string, value: string) => void,
  getContextInput: (server: any, info: GraphQLResolveInfo) => Promise<any>,
  getModuleContext: any,
  errorHandler: ErrorHandler<any, any> | undefined,
  internalData: InternalData,
): [string, GraphQLFieldConfig<any, any>][] {
  return asSpecs(spec)
    .filter((spec) => spec.type === 'mutation')
    .map((spec) => {
      const mutationName = spec.name ?? functionName
      return makeOperation(
        'mutation',
        moduleName,
        mutationName,
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
 * Turns a spec as obtained by the API into a single list that is easier to work with.
 */
function asSpecs(
  spec: FunctionSpecifications | readonly FunctionSpecifications[] | undefined,
): FunctionSpecifications[] {
  if (spec === undefined) {
    return []
  } else if (spec instanceof Array) {
    return [...spec]
  } else {
    return [spec]
  }
}

/**
 * Creates a tuple with the operation name and a configuration for a resolver for the given operation.
 *
 * The operation is created according to the given function's input and output types.
 * `setHeader`, `getContextInput`, `getModuleContext` and `errorHanlder` are all functions that are
 * somehow needed by the resolver implementation.
 */
function makeOperation(
  operationType: 'query' | 'mutation',
  moduleName: string,
  operationName: string,
  fun: functions.FunctionImplementation,
  setHeader: (server: any, name: string, value: string) => void,
  getContextInput: (server: any, info: GraphQLResolveInfo) => Promise<any>,
  getModuleContext: any,
  errorHandler: ErrorHandler<any, any> | undefined,
  internalData: InternalData,
): [string, GraphQLFieldConfig<any, any>] {
  const resolve = async (
    _parent: unknown,
    resolverInput: Record<string, unknown>,
    serverContext: unknown,
    info: GraphQLResolveInfo,
  ) => {
    // TODO: I have no idea where this should come from, it looks like something from
    // the context, maybe?
    const retrieveValue = undefined as unknown as GenericRetrieve

    // Setup logging
    const operationId = utils.randomOperationId()
    const logger = logging.build({ moduleName, operationId, operationType, operationName, server: 'GQL' })
    setHeader(serverContext, 'operation-id', operationId)

    // Decode all the needed bits to call the function
    const graphQLInputTypeName = 'input'
    const input = decodeInput(fun.input, resolverInput[graphQLInputTypeName], logger) as never
    const partialOutputType = types.partialDeep(fun.output)

    // Retrieve the contexts
    const inputContext = await getContextInput(serverContext, info)
    const context = await getModuleContext(inputContext, { retrieve: retrieveValue, input, operationId, logger })

    // Call the function and handle a possible failure
    const contexts = { serverContext, context }
    const operationData = { operationId, functionName: operationName, retrieve: retrieveValue, input }
    const handlerInput = { logger, ...operationData, errorHandler, ...contexts }
    return fun
      .apply({ context: context, retrieve: retrieveValue, input, operationId, logger })
      .then((res) => handleFunctionResult(res, partialOutputType, handlerInput))
      .catch((error) => handleFunctionError({ ...handlerInput, error }))
  }

  const input = {
    type: typeToGraphQLInputTypeInternal(fun.input, {
      ...internalData,
      defaultName: `${capitalise(operationName)}Input`,
    }),
  }
  const type = typeToGraphQLOutputTypeInternal(fun.output, {
    ...internalData,
    defaultName: `${capitalise(operationName)}Result`,
  })

  const capabilities = fun.retrieve ?? {}
  delete fun.retrieve?.select
  const retrieveType = retrieve.fromType(fun.output, capabilities)
  if (retrieveType.isOk) {
    const graphqlRetrieveArgs = retrieveTypeToGraphqlArgs(retrieveType.value, internalData, capabilities)
    return [operationName, { type, args: { input, ...graphqlRetrieveArgs }, resolve }]
  } else {
    return [operationName, { type, args: { input }, resolve }]
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

/**
 * Given the result of the execution of a function's body it tries to handle it accordingly.
 * If the result is an `Ok` value (or a barebone non-result value) it is unwrapped, encoded and returned.
 * If the result is an `Error` then the `errorHandler` function is called and an error is thrown.
 */
function handleFunctionResult(
  res: unknown,
  partialOutputType: types.Type,
  handleErrorInput: Omit<HandleErrorInput, 'error'>,
) {
  if (result.isFailureResult(res)) {
    handleFunctionError({ ...handleErrorInput, error: res.error })
  } else {
    const value = result.isOkResult(res) ? res.value : res
    const encodedOutput = types.concretise(partialOutputType).encodeWithoutValidation(value as never)
    handleErrorInput.logger.logInfo('Completed.')
    return encodedOutput
  }
}

type HandleErrorInput = {
  functionName: string
  operationId: string
  logger: MondrianLogger
  context: unknown
  serverContext: any
  retrieve: retrieve.GenericRetrieve | undefined
  input: unknown
  errorHandler: ErrorHandler<any, any> | undefined
  error: unknown
}

/**
 * Handles a failing result. If an `errorHandler` is not defined, the error value is simply rethrown.
 * If an `errorHandler` is defined, the error and other additional context is passed to it.
 */
// TODO: chiedere a edo cosa fa un error handler per poter documentare meglio l'intento
async function handleFunctionError(handleErrorInput: HandleErrorInput) {
  const { error, logger: log, errorHandler } = handleErrorInput
  log.logError('Failed with error.')
  if (!errorHandler) {
    throw error
  } else {
    log.logInfo('Performing cleanup action.')
    const { context, serverContext, operationId, input, functionName, retrieve } = handleErrorInput
    const functionArgs = { retrieve, input }
    const errorHandlerInput = { error, log, functionName, operationId, context, functionArgs, ...serverContext }
    const result = await errorHandler(errorHandlerInput)
    if (result) {
      throw createGraphQLError(result.message, result.options)
    } else {
      throw error
    }
  }
}
