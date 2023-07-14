import { ErrorHandler, GraphqlApi } from './api'
import { graphqlInfoToProjection } from './utils'
import { makeExecutableSchema } from '@graphql-tools/schema'
import { createGraphQLError } from '@graphql-tools/utils'
import {
  GenericProjection,
  LazyType,
  RootCustomType,
  decode,
  decodeAndValidate,
  encode,
  getProjectedType,
  getProjectionType,
  isVoidType,
  lazyToType,
} from '@mondrian-framework/model'
import { Functions, GenericModule, buildLogger, randomOperationId } from '@mondrian-framework/module'
import { assertNever, isArray } from '@mondrian-framework/utils'
import { GraphQLResolveInfo, GraphQLScalarType, GraphQLSchema } from 'graphql'

/*
"""
****
"""
scalar Id

"""
****
"""
type User {
  """
  ****
  """
  id: Id!
  posts: [Post!]!
  referrer: User
}

type Post {
  id: Id!
  value: String!
}

"""
****
"""
union Asd = Post | User

input PostInput {
  value: String!
}
*/

type GraphqlType =
  | { type: 'scalar'; description?: string; impl: RootCustomType }
  | { type: 'type' | 'input' | 'enum'; definition?: string; description: string }
  | {
      type: 'union'
      definition: string
      description?: string
      is?: Record<string, undefined | ((v: unknown) => boolean)>
    }
function typeToGqlType(
  t: LazyType,
  typeMap: Record<string, GraphqlType>, //id -> definition
  typeRef: Map<Function, string>, // function -> id
  isInput: boolean,
  isOptional: boolean,
  suggestedName?: string,
): string {
  const isRequired = isOptional ? '' : '!'
  const mt = lazyToType(t)
  if (typeof t === 'function') {
    const id = typeRef.get(t)
    if (id) {
      return `${isInput ? 'I' : ''}${id}${isRequired}`
    }
    if (mt.opts?.name) {
      typeRef.set(t, mt.opts.name)
    }
  }
  return typeToGqlTypeInternal(t, typeMap, typeRef, isInput, isOptional, suggestedName)
}
function typeToGqlTypeInternal(
  t: LazyType,
  typeMap: Record<string, GraphqlType>, //type name -> definition
  typeRef: Map<Function, string>, // function -> type name
  isInput: boolean,
  isOptional: boolean,
  suggestedName?: string,
): string {
  const isRequired = isOptional ? '' : '!'
  const type = lazyToType(t)
  let name: string | undefined = type.opts?.name ?? suggestedName
  const description = type.opts && 'description' in type.opts ? type.opts.description : undefined

  if (type.kind === 'string') {
    return `String${isRequired}`
  }
  if (type.kind === 'custom') {
    const gqlType: GraphqlType = { type: 'scalar', description, impl: type }
    typeMap[type.opts?.name ?? type.name] = gqlType
    return type.name === 'void' ? type.opts?.name ?? type.name : `${type.opts?.name ?? type.name}${isRequired}`
  }
  if (type.kind === 'boolean') {
    return `Boolean${isRequired}`
  }
  if (type.kind === 'number') {
    if (type.opts?.multipleOf != null && type.opts.multipleOf % 1 === 0) {
      return `Int${isRequired}`
    }
    return `Float${isRequired}`
  }
  if (type.kind === 'array-decorator') {
    return `[${typeToGqlType(type.type, typeMap, typeRef, isInput, false, name)}]${isRequired}`
  }
  if (type.kind === 'optional-decorator' || type.kind === 'nullable-decorator') {
    return typeToGqlType(type.type, typeMap, typeRef, isInput, true, name)
  }
  if (type.kind === 'default-decorator') {
    return typeToGqlType(type.type, typeMap, typeRef, isInput, isInput, name)
  }
  if (type.kind === 'relation-decorator') {
    return typeToGqlType(type.type, typeMap, typeRef, isInput, isOptional, name)
  }
  if (type.kind === 'object') {
    name = name ?? 'NAME_NEEDED'
    const fields = Object.entries(type.type).map(([fieldName, fieldT]) => {
      const fieldMType = lazyToType(fieldT)
      const fieldType = typeToGqlType(fieldT, typeMap, typeRef, isInput, false, `${name}_${fieldName}`)
      const desc = fieldMType.opts?.description ? `"""${fieldMType.opts.description}"""\n` : ''
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
  if (type.kind === 'enum') {
    name = name ?? 'NAME_NEEDED'
    typeMap[name] = {
      type: 'enum',
      description,
      definition: `enum ${name} {
      ${type.values.join('\n        ')}
    }`,
    }
    return `${name}${isRequired}`
  }
  if (type.kind === 'union-operator') {
    name = name ?? 'NAME_NEEDED'
    const ts = Object.entries(type.types)
    //If input use @oneOf https://github.com/graphql/graphql-spec/pull/825
    if (isInput) {
      const fields = ts.flatMap(([unionName, fieldT]) => {
        const fieldType = typeToGqlType(fieldT, typeMap, typeRef, isInput, false, unionName)
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
        .map(([k, t], i) => typeToGqlType(t, typeMap, typeRef, isInput, true, k))
        .join(' | ')}`,
      is: Object.fromEntries(
        ts.map(([k]) => [
          k,
          type.opts?.is
            ? (v) => {
                return type.opts!.is![k](v)
              }
            : undefined,
        ]),
      ),
    }
    return `${name}${isRequired}`
  }
  if (type.kind === 'literal') {
    const t = typeof type.value
    const tp = t === 'boolean' ? 'Boolean' : t === 'number' ? 'Float' : t === 'string' ? 'String' : null
    if (type.value === null) {
      typeMap['Null'] = {
        type: 'scalar',
        impl: {
          name: 'Null',
          kind: 'custom',
          decode() {
            return { success: true, value: null }
          },
          encode() {
            return null
          },
          encodedType: type,
          type: null,
          validate(input, options) {
            if (input === null) {
              return { success: true, value: null }
            }
            return { success: false, errors: [{ value: input, error: `Null expected` }] }
          },
        },
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

function generateTypes({ module }: { module: GenericModule }): {
  typeMap: Record<string, GraphqlType>
  inputTypeMap: Record<string, GraphqlType>
} {
  const typeMap: Record<string, GraphqlType> = {}
  const typeRef: Map<Function, string> = new Map()
  const usedTypes: LazyType[] = []
  for (const functionBody of Object.values(module.functions.definitions)) {
    usedTypes.push(functionBody.output)
  }
  for (const type of usedTypes) {
    typeToGqlType(type, typeMap, typeRef, false, false)
  }
  const inputTypeMap: Record<string, GraphqlType> = {}
  const inputTypeRef: Map<Function, string> = new Map()
  const usedInputs: LazyType[] = []
  for (const functionBody of Object.values(module.functions.definitions)) {
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
          const decoded = decodeAndValidate(functionBody.input, input[gqlInputTypeName], {
            cast: true,
            inputUnion: true,
          })
          if (!decoded.success) {
            log('Bad request.')
            throw createGraphQLError(`Invalid input.`, { extensions: decoded.errors })
          }
          const projectionType = () => getProjectionType(functionBody.output)
          const gqlProjection = graphqlInfoToProjection(info, functionBody.output)
          const projection = decode(projectionType(), gqlProjection, { cast: true, strict: true })
          if (!projection.success) {
            log('Bad request. (projection)')
            throw createGraphQLError(`Invalid input.`, { extensions: projection.errors })
          }

          const contextInput = await context(serverContext, info)
          const moduleCtx = await module.context(contextInput, {
            projection: projection.value as GenericProjection,
            input: decoded.value,
            operationId,
            log,
          })
          try {
            const result = await functionBody.apply({
              context: moduleCtx,
              projection: projection.value,
              input: decoded.value,
              operationId,
              log,
            })
            const projectedType = getProjectedType(functionBody.output, projection.value as GenericProjection)
            const encoded = encode(projectedType, result)
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

  const namespaces: Record<string, string[]> = {}
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
        const namespace = specification.namespace !== null ? functionBody.namespace ?? specification.namespace : null
        if (namespace) {
          if (namespaces[namespace]) {
            namespaces[namespace].push(specification.name ?? functionName)
          } else {
            namespaces[namespace] = [specification.name ?? functionName]
          }
        }
        const inputIsVoid = isVoidType(functionBody.input)
        const gqlInputType = inputIsVoid ? null : typeToGqlType(functionBody.input, {}, new Map(), true, false)
        const gqlOutputType = typeToGqlType(functionBody.output, {}, new Map(), false, false)
        const description = functionBody.opts?.description ? `"""${functionBody.opts?.description}"""\n` : null
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
    .flatMap((v) => (v != null ? [v] : []))
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
    //console.log(schemaDefs)
    return schema
  } catch (error) {
    console.log(schemaDefs)
    throw error
  }
}
