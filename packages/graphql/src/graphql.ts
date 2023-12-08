import { FunctionSpecifications, Api, ErrorHandler } from './api'
import { createGraphQLError } from '@graphql-tools/utils'
import { result, retrieve, model, decoding, utils as modelUtils } from '@mondrian-framework/model'
import { GenericRetrieve } from '@mondrian-framework/model/src/retrieve'
import { functions, logger as logging, module, utils } from '@mondrian-framework/module'
import { MondrianLogger } from '@mondrian-framework/module/src/logger'
import { flatMapObject, groupBy, uncapitalise } from '@mondrian-framework/utils'
import { JSONType, capitalise, isArray, mapObject } from '@mondrian-framework/utils'
import { SpanStatusCode, Span } from '@opentelemetry/api'
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
  GraphQLFieldConfigArgumentMap,
  GraphQLInt,
  isOutputType,
  isInputType,
  SelectionNode,
  Kind,
  valueFromASTUntyped,
  GraphQLError,
} from 'graphql'

const IGNORE_ON_GRAPHQL_GENERATION = 'ignore_on_graphql_generation'
const UNION_WRAP_FIELD_NAME = 'value'

/**
 * Generates a name for the given type with the following algorithm:
 * - If the type has a name uses that, otherwise
 * - If the default name is defined uses that, otherwise
 * - Generates a random name in the form "TYPE{N}" where "N" is a random integer
 */
function generateName(type: model.Type, internalData: InternalData): string {
  const concreteType = model.concretise(type)
  const name = concreteType.options?.name
    ? capitalise(concreteType.options.name)
    : internalData.defaultName ?? `ANONYMPUS_TYPE_${internalData.usedNames.size}`
  return name
}

/**
 * Same as {@link generateName} but this happens 'Input' at the type name if not already present.
 */
function generateInputName(type: model.Type, internalData: InternalData): string {
  const concreteType = model.concretise(type)
  const name = concreteType.options?.name
    ? capitalise(concreteType.options.name)
    : internalData.defaultName ?? `ANONYMPUS_TYPE_${internalData.usedNames.size}`
  if (name.toLocaleLowerCase().endsWith('input')) {
    const result = name.slice(0, name.length - 5)
    return `${result}Input`
  } else {
    return `${name}Input`
  }
}

/**
 * Checks if the name is not already taken. If it's a duplicate it will be transformed by adding a number at the end.
 */
function checkNameOccurencies(name: string, internalData: InternalData): string {
  const usedOccurencies = internalData.usedNames.get(name)
  if (usedOccurencies) {
    console.warn(`[GraphQL generation] '${name}' symbol is used multiple times.`)
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
  readonly knownOutputTypes: Map<model.Type, GraphQLOutputType>
  // A map from <explored type> to already generated input type(s)
  readonly knownInputTypes: Map<model.Type, GraphQLInputType>
  // A map for all custom types that have already been explored. Here we just
  // save their name
  readonly knownCustomTypes: Map<string, GraphQLScalarType>
  // map of used names and it's occurencies. Normally should always be { name -> 1 }.
  //if some values are greater than 1 a collision occur.
  readonly usedNames: Map<string, number>
  // The default name to assign to the current type in the iteration process
  readonly defaultName: string | undefined
}

function emptyInternalData(): InternalData {
  return {
    knownOutputTypes: new Map(),
    knownInputTypes: new Map(),
    knownCustomTypes: new Map(),
    usedNames: new Map(),
    defaultName: undefined,
  }
}

function clearInternalData(internalData: InternalData) {
  internalData.knownOutputTypes.clear()
  internalData.knownInputTypes.clear()
  internalData.knownCustomTypes.clear()
  internalData.usedNames.clear()
}

/**
 * Maps a mondrian {@link model.Type Type} into a {@link GraphQLOutputType}.
 */
function typeToGraphQLOutputType(type: model.Type, internalData: InternalData): GraphQLOutputType {
  const knownOutputType = internalData.knownOutputTypes.get(type)
  if (knownOutputType) {
    return knownOutputType
  }
  const graphQLType = model.match(type, {
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

/**
 * Maps a mondrian {@link model.Type Type} into a {@link GraphQLInputType}.
 */
function typeToGraphQLInputType(type: model.Type, internalData: InternalData): GraphQLInputType {
  const knownInputType = internalData.knownInputTypes.get(type)
  if (knownInputType) {
    return knownInputType
  }
  const graphQLType: GraphQLInputType = model.match(type, {
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
  type: model.Type,
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
  type: model.Type,
  defaultType: GraphQLScalarType,
  internalData: InternalData,
): GraphQLScalarType {
  const concreteType = model.concretise(type)
  const hasName = concreteType.options?.name != null
  return !hasName ? defaultType : scalarFromType(type, internalData)
}

// Turns a type into a GraphQL scalar type
function scalarFromType(type: model.Type, internalData: InternalData): GraphQLScalarType<unknown, JSONType> {
  const concreteType = model.concretise(type)
  const name = generateName(type, internalData)
  return new GraphQLScalarType({
    name: checkNameOccurencies(name, internalData),
    description: concreteType.options?.description,
  })
}

function enumToGraphQLType(
  enumeration: model.EnumType<readonly [string, ...string[]]>,
  internalData: InternalData,
): GraphQLEnumType {
  const name = generateName(enumeration, internalData)
  const variants = enumeration.variants.map((variant) => [variant, { value: variant }])
  const values = Object.fromEntries(variants)
  return new GraphQLEnumType({ name: checkNameOccurencies(name, internalData), values })
}

// Turns a literal into a GraphQL scalar.
function literalToGraphQLType(
  literal: model.LiteralType<number | string | null | boolean>,
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
  array: model.ArrayType<any, any>,
  internalData: InternalData,
): GraphQLList<GraphQLOutputType> {
  const arrayName = generateName(array, internalData)
  const itemDefaultName = arrayName + 'Item'
  const itemsType = typeToGraphQLOutputType(array.wrappedType, {
    ...internalData,
    defaultName: itemDefaultName,
  })
  const wrappedType = model.isOptional(array.wrappedType) ? itemsType : new GraphQLNonNull(itemsType)
  return new GraphQLList(wrappedType)
}

function arrayToInputGraphQLType(
  array: model.ArrayType<any, any>,
  internalData: InternalData,
): GraphQLList<GraphQLInputType> {
  const arrayName = generateInputName(array, internalData)
  const itemDefaultName = arrayName + 'Item'
  const itemsType = typeToGraphQLInputType(array.wrappedType, {
    ...internalData,
    defaultName: itemDefaultName,
  })
  const wrappedType = model.isOptional(array.wrappedType) ? itemsType : new GraphQLNonNull(itemsType)
  return new GraphQLList(wrappedType)
}

function objectToGraphQLType(
  object: model.ObjectType<any, model.Types>,
  internalData: InternalData,
): GraphQLObjectType {
  const objectName = generateName(object, internalData)
  const fields = () =>
    flatMapObject(object.fields, typeToGraphQLObjectField({ ...internalData, defaultName: undefined }, objectName))
  return new GraphQLObjectType({
    name: checkNameOccurencies(objectName, internalData),
    fields,
    description: object.options?.description,
  })
}

function objectToInputGraphQLType(
  object: model.ObjectType<any, model.Types>,
  internalData: InternalData,
): GraphQLInputObjectType {
  const objectName = generateInputName(object, internalData)
  const fields = () =>
    mapObject(object.fields, typeToGraphQLInputObjectField({ ...internalData, defaultName: undefined }, objectName))
  return new GraphQLInputObjectType({
    name: checkNameOccurencies(objectName, internalData),
    fields,
    description: object.options?.description,
  })
}

function entityToGraphQLType(
  entity: model.EntityType<any, model.Types>,
  internalData: InternalData,
): GraphQLObjectType {
  const entityName = generateName(entity, internalData)
  const fields = () =>
    flatMapObject(entity.fields, typeToGraphQLObjectField({ ...internalData, defaultName: undefined }, entityName))
  return new GraphQLObjectType({
    name: checkNameOccurencies(entityName, internalData),
    fields,
    description: entity.options?.description,
  })
}

function entityToInputGraphQLType(
  entity: model.EntityType<any, model.Types>,
  internalData: InternalData,
): GraphQLInputObjectType {
  const entityName = generateInputName(entity, internalData)
  const fields = () =>
    mapObject(entity.fields, typeToGraphQLInputObjectField({ ...internalData, defaultName: undefined }, entityName))
  return new GraphQLInputObjectType({
    name: checkNameOccurencies(entityName, internalData),
    fields,
    description: entity.options?.description,
  })
}

function typeToGraphQLObjectField(
  internalData: InternalData,
  objectName: string,
): (fieldName: string, fieldType: model.Type) => [string, GraphQLFieldConfig<any, any>][] {
  return (fieldName, fieldType) => {
    const tags = model.concretise(fieldType).options?.tags ?? {}
    if (tags[IGNORE_ON_GRAPHQL_GENERATION] === true) {
      return []
    }
    const fieldDefaultName = generateName(fieldType, {
      ...internalData,
      defaultName: objectName + capitalise(fieldName),
      usedNames: new Map(), //because we are not using it now, it's only potentially used
    })
    const graphQLType = typeToGraphQLOutputType(fieldType, {
      ...internalData,
      defaultName: fieldDefaultName,
    })
    const canBeMissing = model.isOptional(fieldType) || model.isNullable(fieldType)
    const unwrappedFieldType = model.unwrap(fieldType)
    const canBeRetrieved = unwrappedFieldType.kind === model.Kind.Entity && model.isArray(fieldType)
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
    return [
      [
        fieldName,
        {
          type: canBeMissing ? graphQLType : new GraphQLNonNull(graphQLType),
          args: graphqlRetrieveArgs,
          description: model.getFirstDescription(fieldType),
        },
      ],
    ]
  }
}

function retrieveTypeToGraphqlArgs(
  retrieveType: model.ObjectType<model.Mutability.Immutable, model.Types>,
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
): (fieldName: string, fieldType: model.Type) => GraphQLInputFieldConfig {
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
    const canBeMissing = model.isOptional(fieldType) || model.isNullable(fieldType)
    return { type: canBeMissing ? graphQLType : new GraphQLNonNull(graphQLType) }
  }
}

function unionToGraphQLType(union: model.UnionType<model.Types>, internalData: InternalData): GraphQLUnionType {
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
        `[GraphQL generation] Cannot generate GraphQL union with non-object variants. Union ${unionName}, Variant ${variantName}`,
      )
    }
  })
  return new GraphQLUnionType({
    name: checkNameOccurencies(unionName, internalData),
    types: unionTypes,
    resolveType: (value) => {
      const i = Object.keys(union.variants).findIndex((variantName) => {
        return variantName === model.partialDeep(union).variantOwnership(value as never)
      })
      return unionTypes[i].name
    },
  })
}

function unionToInputGraphQLType(
  union: model.UnionType<model.Types>,
  internalData: InternalData,
): GraphQLInputObjectType {
  const unionName = generateInputName(union, internalData)
  const fields = () =>
    mapObject(union.variants, typeToGraphQLInputUnionVariant({ ...internalData, defaultName: undefined }, unionName))
  return new GraphQLInputObjectType({ name: checkNameOccurencies(unionName, internalData), fields })
}

function typeToGraphQLInputUnionVariant(
  internalData: InternalData,
  unionName: string,
): (fieldName: string, fieldType: model.Type) => GraphQLInputFieldConfig {
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
    return { type: getNullableType(graphQLType) }
  }
}

function customTypeToGraphQLType(
  type: model.CustomType<string, any, any>,
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

/**
 * Information needed to create a graphql schema from a mondrian module.
 */
export type FromModuleInput<ServerContext, Fs extends functions.Functions, ContextInput> = {
  api: Api<Fs, ContextInput>
  context: (context: ServerContext, info: GraphQLResolveInfo) => Promise<ContextInput>
  setHeader: (context: ServerContext, name: string, value: string) => void
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
  const { api } = input
  const moduleFunctions = Object.entries(api.module.functions)
  const internalData: InternalData = emptyInternalData()
  const queriesArray = moduleFunctions.map(([functionName, functionBody]) => {
    const specs = api.functions[functionName]
    return {
      namespace: functionBody.options?.namespace ?? '',
      fields: (specs && isArray(specs) ? specs : specs ? [specs] : [])
        .filter((spec) => spec.type === 'query')
        .map((spec) => makeOperation(api.module, spec, functionName, functionBody, input, internalData)),
    }
  })
  const queries = splitIntoNamespaces(queriesArray, 'Query')
  const mutationsArray = moduleFunctions.map(([functionName, functionBody]) => {
    const specs = api.functions[functionName]
    return {
      namespace: functionBody.options?.namespace ?? '',
      fields: (specs && isArray(specs) ? specs : specs ? [specs] : [])
        .filter((spec) => spec.type === 'mutation')
        .map((spec) => makeOperation(api.module, spec, functionName, functionBody, input, internalData)),
    }
  })
  const mutations = splitIntoNamespaces(mutationsArray, 'Mutation')
  if (queries.length === 0) {
    queries.push(['void', { type: GraphQLString, resolve: () => 'void' }])
  }
  if (mutations.length === 0) {
    mutations.push(['void', { type: GraphQLString, resolve: () => 'void' }])
  }
  const query = new GraphQLObjectType({ name: 'Query', fields: Object.fromEntries(queries) })
  const mutation = new GraphQLObjectType({ name: 'Mutation', fields: Object.fromEntries(mutations) })

  const schema = new GraphQLSchema({ query, mutation })
  clearInternalData(internalData) //clear because this is kept is some closure
  //const schemaPrinted = printSchema(schema)
  //fs.writeFileSync('schema.graphql', schemaPrinted, {})
  return schema
}

/**
 * Splits the variuos query (or mutation) fields in namespaces.
 * ```graphql
 * type Query {
 *   user: UserQueryNamespaces # resolve always as '{}'
 *   otherQueryWithNoNamspace: YourOutput
 * }
 * type UserQueryNamespaces {
 *    #... your queries under 'user' namespace
 * }
 * ```
 */
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
      const op = type === 'Query' ? 'queries' : 'mutations'
      return [
        [
          uncapitalise(namespace),
          {
            type: new GraphQLObjectType({
              name: `${capitalise(namespace)}${type}Namespace`,
              fields: Object.fromEntries(fields),
              description: `This type contains the ${op} belonging to "${namespace}" namespace.`,
            }),
            resolve: () => ({}),
            description: `Contains the ${op} belonging to "${namespace}" namespace.`,
          },
        ],
      ]
    },
  )
  return splittedOperations
}

/**
 * Gathers retrieve infomartion by traversing the graphql nodes of the request.
 */
function selectionNodeToRetrieve(info: SelectionNode): Exclude<retrieve.GenericSelect, null> {
  if (info.kind === Kind.FIELD) {
    const argumentEntries = info.arguments?.map((arg) => {
      const value = valueFromASTUntyped(arg.value)
      return [arg.name.value, value]
    })
    const args = argumentEntries ? Object.fromEntries(argumentEntries) : undefined
    const selections = info.selectionSet?.selections
      .filter((n) => n.kind !== Kind.INLINE_FRAGMENT || !n.typeCondition?.name.value.includes('Failure')) //TODO: weak check
      .map(selectionNodeToRetrieve)
    const select = selections?.length ? selections.reduce((p, c) => ({ ...p, ...c })) : undefined
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
function makeOperation<Fs extends functions.Functions, ServerContext, ContextInput>(
  module: module.Module<Fs, ContextInput>,
  specification: FunctionSpecifications,
  functionName: string,
  functionBody: functions.FunctionImplementation,
  fromModuleInput: FromModuleInput<ServerContext, Fs, ContextInput>,
  internalData: InternalData,
): [string, GraphQLFieldConfig<any, any>] {
  const operationName = specification.name ?? functionName
  let input: { type: GraphQLInputType } | undefined = undefined
  if (!model.isNever(functionBody.input)) {
    const plainInput = typeToGraphQLInputType(functionBody.input, {
      ...internalData,
      defaultName: `${capitalise(operationName)}Input`,
    })
    const isInputNullable = model.isOptional(functionBody.input) || model.isNullable(functionBody.input)
    input = { type: isInputNullable ? plainInput : new GraphQLNonNull(plainInput) }
  }
  const graphQLInputTypeName = specification.inputName ?? 'input'

  const { outputType, isOutputTypeWrapped } = getFunctionOutputTypeWithErrors(functionBody, operationName)
  const partialOutputType = model.concretise(model.partialDeep(outputType))
  const plainOutput = typeToGraphQLOutputType(outputType, {
    ...internalData,
    defaultName: `${capitalise(operationName)}Result`,
  })
  const isOutputNullable = model.isOptional(outputType) || model.isNullable(outputType)
  const output = isOutputNullable ? plainOutput : new GraphQLNonNull(plainOutput)

  const capabilities = functionBody.retrieve ?? {}
  const retrieveType = retrieve.fromType(functionBody.output, capabilities)
  const completeRetrieveType = retrieve.fromType(functionBody.output, { ...capabilities, select: true })

  const thisLogger = logging.build({
    moduleName: module.name,
    operationType: specification.type,
    operationName,
    server: 'GQL',
  })

  const resolve = (
    _: unknown,
    resolverInput: Record<string, unknown>,
    serverContext: ServerContext,
    info: GraphQLResolveInfo,
  ) =>
    functionBody.tracer.startActiveSpan(`mondrian:graphql-resolver:${functionName}`, async (span) => {
      const tracer = functionBody.tracer.withPrefix(`mondrian:graphql-resolver:${functionName}:`)
      try {
        // Setup logging
        const operationId = utils.randomOperationId()
        span?.setAttribute('operationId', operationId)
        const logger = thisLogger.updateContext({ operationId })
        fromModuleInput.setHeader(serverContext, 'operation-id', operationId)

        // Decode all the needed bits to call the function
        const input = model.isNever(functionBody.input)
          ? undefined
          : decodeInput(functionBody.input, resolverInput[graphQLInputTypeName], logger, tracer)
        const retrieveValue = completeRetrieveType.isOk
          ? decodeRetrieve(info, completeRetrieveType.value, isOutputTypeWrapped, tracer)
          : {}

        let moduleContext
        try {
          //Context building
          const contextInput = await fromModuleInput.context(serverContext, info)
          moduleContext = await module.context(contextInput, {
            retrieve: retrieveValue,
            input,
            operationId,
            logger,
            functionName,
          })

          // Function call
          const applyOutput = await functionBody.apply({
            context: moduleContext as Record<string, unknown>,
            retrieve: retrieveValue,
            input: input as never,
            operationId,
            logger,
          })

          //Output processing
          let outputValue
          if (functionBody.errors) {
            const applyResult = applyOutput as result.Result<unknown, Record<string, unknown>>
            if (applyResult.isOk) {
              //wrap in an object if the output was wrapped by getFunctionOutputTypeWithErrors function
              const objectValue = isOutputTypeWrapped ? { value: applyResult.value } : applyResult.value
              outputValue = partialOutputType.encodeWithoutValidation(objectValue as never)
            } else {
              const errorCode = Object.keys(applyResult.error)[0]
              const errorValue = applyResult.error[errorCode]
              const mappedError = {
                '[GraphQL generation]: isError': true,
                errorCode,
                errorValue,
                errors: applyResult.error,
              }
              outputValue = partialOutputType.encodeWithoutValidation(mappedError as never)
            }
            endSpanWithResult(applyResult, span)
          } else {
            outputValue = partialOutputType.encodeWithoutValidation(applyOutput as never)
            span?.setStatus({ code: SpanStatusCode.OK })
            span?.end()
          }
          return outputValue
        } catch (error) {
          if (fromModuleInput.errorHandler) {
            const result = await fromModuleInput.errorHandler({
              context: moduleContext,
              error,
              functionArgs: { retrieve: retrieveValue, input },
              functionName: operationName,
              logger,
              operationId,
              ...serverContext,
            })
            if (result) {
              span?.setStatus({ code: SpanStatusCode.ERROR, message: result.message })
              span?.end()
              throw createGraphQLError(result.message, result.options)
            }
          }
          handleUnknownError(error, span)
        }
      } catch (error) {
        span?.end()
        throw error
      }
    })

  const retrieveArgs = retrieveType.isOk
    ? retrieveTypeToGraphqlArgs(retrieveType.value, internalData, capabilities)
    : undefined
  return [
    operationName,
    {
      type: output,
      args: input === undefined ? retrieveArgs : { [graphQLInputTypeName]: input, ...retrieveArgs },
      resolve,
      description: functionBody.options?.description,
    },
  ]
}

function endSpanWithGraphQLError(error: GraphQLError, span: Span | undefined): GraphQLError {
  span?.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
  span?.end()
  return error
}

function endSpanWithResult<R extends result.Result<any, any>>(res: R, span: Span | undefined): R {
  const spanStatusCode = res.isOk ? SpanStatusCode.OK : SpanStatusCode.ERROR
  const message = res.isOk ? undefined : JSON.stringify(res.error)
  span?.setStatus({ code: spanStatusCode, message })
  span?.end()
  return res
}

function handleUnknownError(error: unknown, span: Span | undefined): never {
  if (error instanceof Error) {
    throw endSpanWithGraphQLError(createGraphQLError(error.message, { originalError: error }), span)
  } else {
    throw endSpanWithGraphQLError(createGraphQLError(`Internal server error.`), span)
  }
}

/**
 * Gets the function output type based on errors support and function output type.
 * If function.errors is not set -> the function output is returned and not wrapped
 * If function.erros is defined -> returns a output that is the union between function output type
 *   and the function errors. The function output type is wrapped in an object if it's not an object
 *   nor an entity.
 */
function getFunctionOutputTypeWithErrors(
  fun: functions.FunctionInterface,
  functionName: string,
): { outputType: model.Type; isOutputTypeWrapped: boolean } {
  if (!fun.errors) {
    return { outputType: fun.output, isOutputTypeWrapped: false }
  }
  const isOutputTypeWrapped = !model.isEntity(fun.output) && !model.isObject(fun.output)
  const success = isOutputTypeWrapped
    ? model.object({ [UNION_WRAP_FIELD_NAME]: fun.output }).setName(`${capitalise(functionName)}Success`)
    : fun.output
  if (Object.keys(fun.errors).includes('code')) {
    throw new Error("[GraphQL generation] 'code' is reserved as error code")
  }
  if (Object.keys(fun.errors).includes('value')) {
    throw new Error("[GraphQL generation] 'value' is reserved as error code")
  }
  const error = model
    .object({
      //[GraphQL generation]: isError' is used to be confident that the union ownership is inferred correctly.
      '[GraphQL generation]: isError': model.literal(true, { tags: { [IGNORE_ON_GRAPHQL_GENERATION]: true } }),
      errorCode: model.string(),
      errorValue: model.unknown(),
      errors: model
        .object(mapObject(fun.errors, (_, errorType) => model.optional(errorType)))
        .setName(`${capitalise(functionName)}Errors`),
    })
    .setName(`${capitalise(functionName)}Failure`)
  return {
    outputType: model.union({ success, error }).setName(`${capitalise(functionName)}Result`),
    isOutputTypeWrapped,
  }
}

/**
 * Tries to decode the given raw input, throwing a graphql error if the process fails.
 * A logger is needed to perform additional logging and keep track of the decoding result.
 */
function decodeInput(inputType: model.Type, rawInput: unknown, log: MondrianLogger, tracer: functions.Tracer): unknown {
  const decoded = tracer.startActiveSpan(`decode-input`, (span) =>
    endSpanWithResult(
      model.concretise(mapInputType(inputType)).decode(rawInput, { typeCastingStrategy: 'tryCasting' }),
      span,
    ),
  )
  if (decoded.isOk) {
    return decoded.value
  } else {
    log.logError('Bad request. (input)')
    throw createGraphQLError(`Invalid input.`, { extensions: decoded.error })
  }
}

/**
 * Tagged union used only for decoding unions on graphql input.
 */
function taggedUnion(union: model.UnionType<model.Types>): model.Type {
  const variantsKeys = Object.keys(union.variants)
  return model.custom<'tagged-union', {}, any>({
    typeName: 'tagged-union',
    encoder: () => {
      throw new Error('Unreachable')
    },
    decoder: (v, options) => {
      const keys = Object.keys(v ?? {})
      if (!v || typeof v !== 'object' || keys.length !== 1 || !variantsKeys.includes(keys[0])) {
        return decoding.fail(`object with exactly one of this keys: ${variantsKeys.map((v) => `'${v}'`).join(', ')}`, v)
      }
      const type = union.variants[keys[0]]
      const mappedType = mapInputType(type)
      return model.concretise(mappedType).decodeWithoutValidation((v as Record<string, unknown>)[keys[0]], options)
    },
    validator: (v, options) => {
      return union.validate(v as never, options)
    },
    arbitrary: () => {
      throw new Error('Unreachable')
    },
  })
}

/**
 * Replaces all union type of a type with the custom type {@link taggedUnion} in order to
 * decode the union type as defined in GraphQL.
 */
const mapInputType = modelUtils.memoizeTypeTransformation(mapInputTypeInternal)
function mapInputTypeInternal(inputType: model.Type): model.Type {
  return model.match(inputType, {
    union: (union) => taggedUnion(union),
    object: ({ fields }) => model.object(mapObject(fields, (_, fieldType) => mapInputType(fieldType))),
    array: ({ wrappedType }) => model.array(mapInputType(wrappedType)),
    optional: ({ wrappedType }) => model.optional(mapInputType(wrappedType)),
    nullable: ({ wrappedType }) => model.nullable(mapInputType(wrappedType)),
    otherwise: (_, t) => t,
  })
}

/**
 * Extracts the retrieve value by traversing the {@link GraphQLResolveInfo} and then decode it with the
 * respective retrieveType.
 */
function decodeRetrieve(
  info: GraphQLResolveInfo,
  retrieveType: model.Type,
  isOutputTypeWrapped: boolean,
  tracer: functions.Tracer,
): GenericRetrieve {
  if (info.fieldNodes.length !== 1) {
    throw createGraphQLError(
      'Invalid field nodes count. Probably you are requesting the same query or mutation multiple times.',
    )
  }
  const result = tracer.startActiveSpan('decode-retrieve', (span) => {
    const node = info.fieldNodes[0]
    const retrieve = selectionNodeToRetrieve(node)
    const rawRetrieve = retrieve[node.name.value]
    let finalRetrieve = rawRetrieve
    if (
      isOutputTypeWrapped &&
      typeof rawRetrieve === 'object' &&
      rawRetrieve.select &&
      typeof rawRetrieve.select[UNION_WRAP_FIELD_NAME] === 'object'
    ) {
      //unwrap the selection
      const unwrappedSelect = rawRetrieve.select[UNION_WRAP_FIELD_NAME].select
      finalRetrieve = { ...rawRetrieve, select: unwrappedSelect }
    }
    const result = model.concretise(retrieveType).decode(finalRetrieve === true ? {} : finalRetrieve)
    return endSpanWithResult(result, span)
  })
  if (result.isOk) {
    return result.value
  } else {
    throw createGraphQLError('Failed to decode query parameters', { extensions: result.error })
  }
}
