import { GraphQLSchema, GraphQLResolveInfo, GraphQLScalarType } from 'graphql'
import { extractFieldsFromGraphqlInfo } from './utils'
import { createGraphQLError, createSchema } from 'graphql-yoga'
import { FastifyReply, FastifyRequest } from 'fastify'
import { CustomType, LazyType, decode, encode, isNullType, isVoidType, lazyToType } from '@mondrian/model'
import { assertNever } from '@mondrian/utils'
import {
  ContextType,
  Functions,
  GenericModule,
  buildLogger,
  getProjectionType,
  randomOperationId,
} from '@mondrian/module'
import { ModuleGraphqlApi } from './server'

function typeToGqlType(
  name: string,
  t: LazyType,
  types: Record<string, LazyType>, //same as module
  typeMap: Record<string, string>, //type name -> definition
  typeRef: Map<Function, string>, // function -> type name
  isInput: boolean,
  isOptional: boolean,
  scalars: Record<string, CustomType>,
  unions: Record<string, (v: unknown) => boolean>,
  isUnion?: (v: unknown) => boolean,
): string {
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
      return `${n}${isRequired}`
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
  typeMap: Record<string, string>, //type name -> definition
  typeRef: Map<Function, string>, // function -> type name
  isInput: boolean,
  isOptional: boolean,
  scalars: Record<string, CustomType>,
  unions: Record<string, (v: unknown) => boolean>,
): string {
  const isRequired = isOptional ? '' : '!'
  const input = isInput ? 'I' : ''
  const type = lazyToType(t)
  if (type.kind === 'string') {
    return `String${isRequired}`
  }
  if (type.kind === 'custom') {
    scalars[type.name] = type
    return `${type.name}${isRequired}`
  }
  if (type.kind === 'boolean') {
    return `Boolean${isRequired}`
  }
  if (type.kind === 'number') {
    //TODO: Int
    return `Float${isRequired}`
  }
  if (type.kind === 'array-decorator') {
    return `[${typeToGqlType(name, type.type, types, typeMap, typeRef, isInput, false, scalars, unions)}]${isRequired}`
  }
  if (type.kind === 'optional-decorator' || type.kind === 'default-decorator') {
    return typeToGqlType(name, type.type, types, typeMap, typeRef, isInput, true, scalars, unions)
  }
  if (type.kind === 'reference-decorator') {
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
      return `${fieldName}: ${fieldType}`
    })
    typeMap[`${input}${name}`] = `${isInput ? 'input' : 'type'} ${input}${name} {
        ${fields.join('\n        ')}
    }`
    return `${input}${name}${isRequired}`
  }
  if (type.kind === 'enumerator') {
    typeMap[name] = `enum ${name} {
      ${type.values.join('\n        ')}
    }`
    return `${name}${isRequired}`
  }
  if (type.kind === 'union-operator') {
    const ts = Object.entries(type.types)
    //If input use @oneOf https://github.com/graphql/graphql-spec/pull/825
    if (isInput) {
      const fields = ts.map(([unionName, fieldT]) => {
        const fieldType = typeToGqlType(unionName, fieldT, types, typeMap, typeRef, isInput, false, scalars, unions)
        const realType =
          fieldType.charAt(fieldType.length - 1) === '!' ? fieldType.substring(0, fieldType.length - 1) : fieldType
        return `${unionName}: ${realType}`
      })
      typeMap[`${input}${name}`] = `input ${input}${name} {
          ${fields.join('\n        ')}
      }`
      return `${input}${name}${isRequired}`
    }

    //remove the Null types
    if (ts.length >= 2 && ts.some((t) => isNullType(t[1]))) {
      const filteredTs = ts.filter((t) => isNullType(t[1]))
      if (filteredTs.length === 1) {
        const e = typeToGqlType(
          filteredTs[0][0],
          filteredTs[0][1],
          types,
          typeMap,
          typeRef,
          isInput,
          true,
          scalars,
          unions,
        )
        return `${e}${isRequired}`
      }
      typeMap[name] = `union ${name} = ${filteredTs
        .map(([k, t], i) => typeToGqlType(k, t, types, typeMap, typeRef, isInput, true, scalars, unions))
        .join(' | ')}`
      return `${name}${isRequired}`
    }
    typeMap[name] = `union ${name} = ${ts
      .map(([k, t], i) =>
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
        ),
      )
      .join(' | ')}`
    return `${name}${isRequired}`
  }
  if (isNullType(type)) {
    scalars['Null'] = {
      decode: (input) =>
        input === null
          ? { pass: true, value: null }
          : { pass: false, errors: [{ path: '', error: 'Null expected', value: input }] },
      encode: (input) => input,
      is: (input) => input === null,
      kind: 'custom',
      name: 'Null',
      type: null,
    }
    return `Null${isRequired}`
  }
  if (type.kind === 'literal') {
    const t = typeof type.value
    //TODO: Int
    const tp = t === 'boolean' ? 'Boolean' : t === 'number' ? 'Float' : t === 'string' ? 'String' : null
    if (tp === null) {
      throw new Error(`Unknown literal type: ${tp}`)
    }
    return `${tp}${isRequired}`
  }
  return assertNever(type)
}

function generateInputs({ module, scalarsMap }: { module: GenericModule; scalarsMap: Record<string, CustomType> }) {
  const typeMap: Record<string, string> = {}
  const typeRef: Map<Function, string> = new Map()
  const usedTypes = new Set([...Object.values(module.functions).map((q) => q.input)])
  for (const [name, type] of Object.entries(module.types).filter(
    ([name, type]) => usedTypes.has(name) && !isVoidType(type),
  )) {
    typeToGqlType(name, type, module.types, typeMap, typeRef, true, false, scalarsMap, {})
  }
  return Object.values(typeMap).join('\n\n')
}

function generateTypes({ module, scalarsMap }: { module: GenericModule; scalarsMap: Record<string, CustomType> }): {
  gql: string
  unions: Record<string, (v: unknown) => boolean>
} {
  const typeMap: Record<string, string> = {}
  const typeRef: Map<Function, string> = new Map()
  const unions: Record<string, (v: unknown) => boolean> = {}
  const usedTypes = new Set([...Object.values(module.functions).map((q) => q.output)])
  for (const [name, type] of Object.entries(module.types).filter(
    ([name, type]) => usedTypes.has(name) && !isVoidType(type),
  )) {
    typeToGqlType(name, type, module.types, typeMap, typeRef, false, false, scalarsMap, unions)
  }
  return { gql: Object.values(typeMap).join('\n\n'), unions }
}

function generateScalars({ scalarsMap }: { scalarsMap: Record<string, CustomType> }) {
  const scalarDefs = Object.values(scalarsMap)
    .map((s) => `scalar ${s.name}`)
    .join('\n')
  const scalarResolvers = Object.fromEntries(
    Object.values(scalarsMap).map((s) => {
      return [
        s.name,
        new GraphQLScalarType({
          name: s.name,
          description: '',
          serialize(input) {
            return input
          },
          parseValue(input) {
            return input
          },
          //TODO: how tell graphql sanbox what type to expect
        }),
      ] as const
    }),
  )
  return { scalarDefs, scalarResolvers }
}

function generateQueryOrMutation({
  module,
  type,
  api,
  context,
}: {
  type: 'query' | 'mutation'
  module: GenericModule
  api: ModuleGraphqlApi<Functions>
  context: (args: { request: FastifyRequest; info: GraphQLResolveInfo }) => Promise<ContextType<Functions>>
}) {
  const functions = Object.entries(module.functions).filter(
    ([functionName, _]) => api.functions[functionName]?.type === type,
  )
  const resolvers = Object.fromEntries(
    functions.flatMap(([functionName, functionBody]) => {
      const specification = api.functions[functionName]
      if (!specification) {
        return []
      }
      const gqlInputTypeName = specification.inputName ?? 'input'
      const resolver = async (
        parent: unknown,
        input: Record<string, unknown>,
        ctx: { fastify: { request: FastifyRequest; reply: FastifyReply } },
        info: GraphQLResolveInfo,
      ) => {
        const operationId = randomOperationId()
        const log = buildLogger(
          module.name,
          operationId,
          specification.type.toUpperCase(),
          specification.name ?? functionName,
          'GQL',
          new Date(),
        )
        ctx.fastify.reply.header('operation-id', operationId)
        const decoded = decode(module.types[functionBody.input], input[gqlInputTypeName], {
          cast: true,
          castGqlInputUnion: true,
        })
        if (!decoded.pass) {
          log('Bad request.')
          throw createGraphQLError(`Invalid input.`, { extensions: decoded.errors })
        }
        const outputType = module.types[functionBody.output]
        const fieldType = () => getProjectionType(outputType)
        const gqlFields = extractFieldsFromGraphqlInfo(info, outputType)
        const fields = decode(fieldType(), gqlFields, { cast: true })
        if (!fields.pass) {
          log('Bad request. (fields)')
          throw createGraphQLError(`Invalid input.`, { extensions: fields.errors })
        }
        try {
          const result = await functionBody.apply({
            context: await context({ request: ctx.fastify.request, info }),
            fields: fields.value,
            input: decoded.value,
            operationId,
            log,
          })
          const encoded = encode(outputType, result)
          log('Completed.')
          return encoded
        } catch (error) {
          log('Failed with exception.')
          throw error
        }
      }
      return [[specification.name ?? functionName, resolver]]
    }),
  )
  const defs = functions
    .flatMap(([functionName, functionBody]) => {
      const specification = api.functions[functionName]
      if (!specification) {
        return []
      }
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
      return [
        inputIsVoid
          ? `${specification.name ?? functionName}: ${gqlOutputType}`
          : `${specification.name ?? functionName}(${
              specification.inputName ?? 'input'
            }: ${gqlInputType}): ${gqlOutputType}`,
      ]
    })
    .join('\n')
  return { defs, resolvers }
}

export function buildGraphqlSchema({
  module,
  api,
  context,
}: {
  module: GenericModule
  api: ModuleGraphqlApi<Functions>
  context: (args: { request: FastifyRequest; info: GraphQLResolveInfo }) => Promise<ContextType<Functions>>
}): GraphQLSchema {
  const { defs: queryDefs, resolvers: queryResolvers } = generateQueryOrMutation({
    module,
    api,
    type: 'query',
    context,
  })
  const { defs: mutationDefs, resolvers: mutationResolvers } = generateQueryOrMutation({
    module,
    api,
    type: 'mutation',
    context,
  })
  const scalarsMap: Record<string, CustomType> = {}
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
    const schema = createSchema({
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

/*
  import SchemaBuilder, { FieldRef, InputFieldRef, InputObjectRef, ObjectRef } from '@pothos/core'
  const builder = new SchemaBuilder({})

  const gqpTypes: Record<string, ObjectRef<any, any>> = {}
  for (const [typeName, t] of Object.entries(module.types)) {
    const type = lazyToType(t)
    if (type.kind === 'object') {
      const gqlType = builder.objectType(typeName as any, {
        fields: (t) => {
          const fields: [string, FieldRef][] = []
          for (const [fieldName, fieldT] of Object.entries(type.type)) {
            const fieldType = lazyToType(fieldT)
            if (fieldType.kind === 'string') {
              fields.push([
                fieldName,
                t.string({
                  resolve: (parent) => {
                    return parent[fieldName]
                  },
                }),
              ] as [string, FieldRef])
            }
          }
          return Object.fromEntries(fields)
        },
      })
      gqpTypes[typeName] = gqlType
    }
  }

  const gqlInputs: Record<string, InputObjectRef<any>> = {}
  for (const [typeName, t] of Object.entries(module.types)) {
    const type = lazyToType(t)
    if (type.kind === 'object') {
      const gqlType = builder.inputType(`${typeName}_Input`, {
        fields: (t) => {
          const fields: [string, InputFieldRef][] = []
          for (const [fieldName, fieldT] of Object.entries(type.type)) {
            const fieldType = lazyToType(fieldT)
            if (fieldType.kind === 'string') {
              fields.push([fieldName, t.string({ required: true })] as [string, InputFieldRef])
            }
          }
          return Object.fromEntries(fields)
        },
      })
      gqlInputs[typeName] = gqlType
    }
  }

  builder.queryType({
    fields: (t) => {
      const fields: [string, FieldRef<any, 'Query'>][] = []
      for (const [operationName, query] of Object.entries(module.operations.queries)) {
        const resolver = module.resolvers.queries[operationName].f
        const inputType = lazyToType(module.types[query.input])
        const gqlInputType =
          inputType.kind === 'object'
            ? t.arg({ type: gqlInputs[query.input] })
            : inputType.kind === 'string'
            ? t.arg({ type: 'String', required: true })
            : t.arg({ type: gqlInputs[query.input] })
        const gqlInputTypeName = query.options?.graphql?.inputName ?? 'input'
        fields.push([
          operationName,
          t.field({
            nullable: true,
            type: gqpTypes[query.output],
            args: {
              [gqlInputTypeName]: gqlInputType,
            },
            resolve: (parent, input, context, info) =>
              resolver({ context, fields: info, input: input[gqlInputTypeName] } as any) as any,
          }),
        ])
      }
      return Object.fromEntries(fields)
    },
  })
  return builder.toSchema()
  */
