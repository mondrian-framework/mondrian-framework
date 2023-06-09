import { ErrorHandler, GraphqlApi } from './api'
import { graphqlInfoToProjection } from './utils'
import { makeExecutableSchema } from '@graphql-tools/schema'
import { createGraphQLError } from '@graphql-tools/utils'
import {
  LazyType,
  RootCustomType,
  decode,
  decodeAndValidate,
  encode,
  getProjectionType,
  isVoidType,
  lazyToType,
} from '@mondrian-framework/model'
import { ContextType, Functions, GenericModule, buildLogger, randomOperationId } from '@mondrian-framework/module'
import { assertNever, isArray } from '@mondrian-framework/utils'
import { GraphQLResolveInfo, GraphQLScalarType, GraphQLSchema } from 'graphql'

function typeToGqlType(
  name: string,
  t: LazyType,
  types: Record<string, LazyType>, //same as module
  typeMap: Record<string, { description?: string; type: string }>, //type name -> definition
  typeRef: Map<Function, string>, // function -> type name
  isInput: boolean,
  isOptional: boolean,
  scalars: Record<string, RootCustomType>,
  unions: Record<string, (v: unknown) => boolean>,
  isUnion?: (v: unknown) => boolean,
): { description?: string; type: string } {
  const isRequired = isOptional ? '' : '!'
  for (const [n, type] of Object.entries(types)) {
    if (type === t) {
      name = n
    }
  }
  if (isUnion) {
    unions[name] = isUnion
  }
  if (typeof t === 'function') {
    const n = typeRef.get(t)
    if (n) {
      return { type: `${isInput ? 'I' : ''}${n}${isRequired}`, description: typeMap[n]?.description }
    }
    typeRef.set(t, name)
  }
  const type = typeToGqlTypeInternal(name, t, types, typeMap, typeRef, isInput, isOptional, scalars, unions)
  return type
}
function typeToGqlTypeInternal(
  name: string,
  t: LazyType,
  types: Record<string, LazyType>, //same as module
  typeMap: Record<string, { description?: string; type: string }>, //type name -> definition
  typeRef: Map<Function, string>, // function -> type name
  isInput: boolean,
  isOptional: boolean,
  scalars: Record<string, RootCustomType>,
  unions: Record<string, (v: unknown) => boolean>,
): { description?: string; type: string } {
  const isRequired = isOptional ? '' : '!'
  const input = isInput ? 'I' : ''
  const type = lazyToType(t)
  const description = 'opts' in type && type.opts && 'description' in type.opts ? type.opts.description : undefined
  const desc = description?.length > 0 ? `"""${description}"""\n` : ''
  if (type.kind === 'string') {
    return { description, type: `String${isRequired}` }
  }
  if (type.kind === 'custom') {
    scalars[type.name] = type
    return {
      description: type.format && description ? `${description}\n${type.format}` : type.format ?? description,
      type: `${type.name}${isRequired}`,
    }
  }
  if (type.kind === 'boolean') {
    return { description, type: `Boolean${isRequired}` }
  }
  if (type.kind === 'number') {
    if (type.opts?.multipleOf != null && type.opts.multipleOf % 1 === 0) {
      return { description, type: `Int${isRequired}` }
    }
    return { description, type: `Float${isRequired}` }
  }
  if (type.kind === 'array-decorator') {
    return {
      description,
      type: `[${
        typeToGqlType(name, type.type, types, typeMap, typeRef, isInput, false, scalars, unions).type
      }]${isRequired}`,
    }
  }
  if (type.kind === 'optional-decorator' || type.kind === 'nullable-decorator') {
    return typeToGqlType(name, type.type, types, typeMap, typeRef, isInput, true, scalars, unions)
  }
  if (type.kind === 'default-decorator') {
    return typeToGqlType(name, type.type, types, typeMap, typeRef, isInput, isInput, scalars, unions)
  }
  if (type.kind === 'relation-decorator') {
    return typeToGqlType(name, type.type, types, typeMap, typeRef, isInput, isOptional, scalars, unions)
  }
  if (type.kind === 'object') {
    const fields = Object.entries(type.type).map(([fieldName, fieldT]) => {
      const fieldType = typeToGqlType(
        `${input}${name}_${fieldName}`,
        fieldT,
        types,
        typeMap,
        typeRef,
        isInput,
        false,
        scalars,
        unions,
      )
      const desc = fieldType.description ? `"""${fieldType.description}"""\n` : ''
      return `${desc}${fieldName}: ${fieldType.type}`
    })
    typeMap[`${input}${name}`] = {
      description,
      type: `${desc}${isInput ? 'input' : 'type'} ${input}${name} {
        ${fields.join('\n        ')}
    }`,
    }
    return { description, type: `${input}${name}${isRequired}` }
  }
  if (type.kind === 'enum') {
    typeMap[name] = {
      description,
      type: `${desc}enum ${name} {
      ${type.values.join('\n        ')}
    }`,
    }
    return { description, type: `${name}${isRequired}` }
  }
  if (type.kind === 'union-operator') {
    const ts = Object.entries(type.types)
    //If input use @oneOf https://github.com/graphql/graphql-spec/pull/825
    if (isInput) {
      const fields = ts.flatMap(([unionName, fieldT]) => {
        const fieldType = typeToGqlType(unionName, fieldT, types, typeMap, typeRef, isInput, false, scalars, unions)
        const realType =
          fieldType.type.charAt(fieldType.type.length - 1) === '!'
            ? fieldType.type.substring(0, fieldType.type.length - 1)
            : fieldType.type
        return [`${unionName}: ${realType}`]
      })
      typeMap[`${input}${name}`] = {
        description,
        type: `${desc}input ${input}${name} {
          ${fields.join('\n        ')}
      }`,
      }
      return { description, type: `${input}${name}${isRequired}` }
    }

    typeMap[name] = {
      description,
      type: `${desc}union ${name} = ${ts
        .map(
          ([k, t], i) =>
            typeToGqlType(
              k,
              t,
              types,
              typeMap,
              typeRef,
              isInput,
              true,
              scalars,
              unions,
              type.opts?.is
                ? (v) => {
                    return type.opts!.is![k](v)
                  }
                : undefined,
            ).type,
        )
        .join(' | ')}`,
    }
    return { description, type: `${name}${isRequired}` }
  }
  if (type.kind === 'literal') {
    const t = typeof type.value
    const tp = t === 'boolean' ? 'Boolean' : t === 'number' ? 'Float' : t === 'string' ? 'String' : null
    if (tp === null) {
      throw new Error(`Unknown literal type: ${tp}`)
    }
    return { description, type: `${tp}${isRequired}` }
  }
  return assertNever(type)
}

function generateInputs({ module, scalarsMap }: { module: GenericModule; scalarsMap: Record<string, RootCustomType> }) {
  const typeMap: Record<string, { description?: string; type: string }> = {}
  const typeRef: Map<Function, string> = new Map()
  const usedTypes = new Set([...Object.values(module.functions.definitions).map((q) => q.input)])
  for (const [name, type] of Object.entries(module.types).filter(
    ([name, type]) => usedTypes.has(name) && !isVoidType(type),
  )) {
    typeToGqlType(name, type, module.types, typeMap, typeRef, true, false, scalarsMap, {})
  }
  return Object.values(typeMap)
    .map((v) => v.type)
    .join('\n\n')
}

function generateTypes({ module, scalarsMap }: { module: GenericModule; scalarsMap: Record<string, RootCustomType> }): {
  gql: string
  unions: Record<string, (v: unknown) => boolean>
} {
  const typeMap: Record<string, { description?: string; type: string }> = {}
  const typeRef: Map<Function, string> = new Map()
  const unions: Record<string, (v: unknown) => boolean> = {}
  const usedTypes = new Set([...Object.values(module.functions.definitions).map((q) => q.output)])
  for (const [name, type] of Object.entries(module.types).filter(
    ([name, type]) => usedTypes.has(name) && !isVoidType(type),
  )) {
    typeToGqlType(name, type, module.types, typeMap, typeRef, false, false, scalarsMap, unions)
  }
  return {
    gql: Object.values(typeMap)
      .map((v) => v.type)
      .join('\n\n'),
    unions,
  }
}

function generateScalars({ scalarsMap }: { scalarsMap: Record<string, RootCustomType> }) {
  const scalarDefs = Object.values(scalarsMap)
    .map((s) => (s.opts?.description ? `"""${s.opts?.description}"""\nscalar ${s.name}` : `scalar ${s.name}`))
    .join('\n')
  const scalarResolvers = Object.fromEntries(
    Object.values(scalarsMap).map((s) => {
      return [
        s.name,
        new GraphQLScalarType({
          name: s.name,
          description: s.opts?.description,
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

function generateQueryOrMutation<ServerContext, ContextInput>({
  module,
  type,
  api,
  context,
  setHeader,
  error,
}: {
  type: 'query' | 'mutation'
  module: GenericModule
  api: GraphqlApi<Functions>
  context: (server: ServerContext, info: GraphQLResolveInfo) => Promise<ContextInput>
  setHeader: (server: ServerContext, name: string, value: string) => void
  error?: ErrorHandler<Functions, ServerContext>
}) {
  const resolvers = Object.fromEntries(
    Object.entries(module.functions.definitions).flatMap(([functionName, functionBody]) => {
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
        const inputType = module.types[functionBody.input]
        const outputType = module.types[functionBody.output]

        const resolver = async (
          parent: unknown,
          input: Record<string, unknown>,
          serverContext: ServerContext,
          info: GraphQLResolveInfo,
        ) => {
          const operationId = randomOperationId()
          const log = buildLogger(
            module.name,
            operationId,
            specification.type,
            specification.name ?? functionName,
            'GQL',
            new Date(),
          )
          setHeader(serverContext, 'operation-id', operationId)
          const decoded = decodeAndValidate(inputType, input[gqlInputTypeName], {
            cast: true,
            castGqlInputUnion: true,
          })
          if (!decoded.success) {
            log('Bad request.')
            throw createGraphQLError(`Invalid input.`, { extensions: decoded.errors })
          }
          const projectionType = () => getProjectionType(outputType)
          const gqlProjection = graphqlInfoToProjection(info, outputType)
          const projection = decode(projectionType(), gqlProjection, { cast: true, strict: true })
          if (!projection.success) {
            log('Bad request. (projection)')
            throw createGraphQLError(`Invalid input.`, { extensions: projection.errors })
          }
          const contextInput = await context(serverContext, info)
          const moduleCtx = await module.context(contextInput)
          try {
            const result = await functionBody.apply({
              context: moduleCtx,
              projection: projection.value,
              input: decoded.value,
              operationId,
              log,
            })
            const encoded = encode(outputType, result)
            log('Completed.')
            return encoded
          } catch (e) {
            log('Failed with exception.')
            if (error) {
              const result = await error({
                error: e,
                log,
                functionName,
                operationId,
                context: moduleCtx,
                functionArgs: {
                  projection: projection.value,
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
  const defs = Object.entries(module.functions.definitions)
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
        const inputType = lazyToType(module.types[functionBody.input])
        const inputIsVoid = isVoidType(inputType)
        const gqlInputType = inputIsVoid
          ? null
          : typeToGqlType(functionBody.input, inputType, module.types, {}, new Map(), true, false, {}, {})
        const ouputType = lazyToType(module.types[functionBody.output])
        const gqlOutputType = typeToGqlType(
          functionBody.output,
          ouputType,
          module.types,
          {},
          new Map(),
          false,
          false,
          {},
          {},
        )
        const description = functionBody.opts?.description ? `"""${functionBody.opts?.description}"""\n` : null
        const def = inputIsVoid
          ? `${specification.name ?? functionName}: ${gqlOutputType.type}`
          : `${specification.name ?? functionName}(${specification.inputName ?? 'input'}: ${gqlInputType?.type}): ${
              gqlOutputType.type
            }`
        return description ? [description, def] : [def]
      })
    })
    .join('\n')
  return { defs, resolvers }
}

export function generateGraphqlSchema<ServerContext, ContextInput>({
  module,
  api,
  context,
  setHeader,
  error,
}: {
  module: GenericModule
  api: GraphqlApi<Functions>
  context: (server: ServerContext, info: GraphQLResolveInfo) => Promise<ContextInput>
  setHeader: (server: ServerContext, name: string, value: string) => void
  error?: ErrorHandler<Functions, ServerContext>
}): GraphQLSchema {
  const { defs: queryDefs, resolvers: queryResolvers } = generateQueryOrMutation({
    module,
    api,
    type: 'query',
    context,
    setHeader,
    error,
  })
  const { defs: mutationDefs, resolvers: mutationResolvers } = generateQueryOrMutation({
    module,
    api,
    type: 'mutation',
    context,
    setHeader,
    error,
  })
  const scalarsMap: Record<string, RootCustomType> = {}
  const { gql: typeDefs, unions } = generateTypes({ module, scalarsMap })
  const inputDefs = generateInputs({ module, scalarsMap })
  const { scalarDefs, scalarResolvers } = generateScalars({ scalarsMap })

  const schemaDefs = `
  ${scalarDefs}
  ${typeDefs}
  ${inputDefs}
  ${
    queryDefs.length === 0
      ? ''
      : `type Query {
    ${queryDefs}
  }`
  }
  ${
    mutationDefs.length === 0
      ? ''
      : `type Mutation {
    ${mutationDefs}
  }`
  }
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
      },
    })
    return schema
  } catch (error) {
    console.log(schemaDefs)
    throw error
  }
}
