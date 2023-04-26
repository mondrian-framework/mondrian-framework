import { GraphQLSchema, GraphQLResolveInfo, GraphQLScalarType } from 'graphql'
import { GenericModule, ModuleRunnerOptions } from './mondrian'
import { assertNever, lazyToType } from './utils'
import { CustomType, LazyType, encode } from './type-system'
import { createSchema } from 'graphql-yoga'
import { randomUUID } from 'crypto'
import { decode } from './decoder'

function typeToGqlType(
  name: string,
  t: LazyType,
  types: Record<string, LazyType>, //same as module
  typeMap: Record<string, string>, //type name -> definition
  typeRef: Map<Function, string>, // function -> type name
  isInput: boolean,
  isOptional: boolean,
  scalars: Record<string, CustomType>,
): string {
  const isRequired = isOptional ? '' : '!'
  for (const [n, type] of Object.entries(types)) {
    if (type === t) {
      name = n
    }
  }
  if (typeof t === 'function') {
    const n = typeRef.get(t)
    if (n) {
      return `${n}${isRequired}`
    }
    typeRef.set(t, name)
  }

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
    //TODO: Float
    return `Int${isRequired}`
  }
  if (type.kind === 'array-decorator') {
    return `[${typeToGqlType(name, type.type, types, typeMap, typeRef, isInput, false, scalars)}]${isRequired}`
  }
  if (type.kind === 'optional-decorator' || type.kind === 'default-decorator') {
    return typeToGqlType(name, type.type, types, typeMap, typeRef, isInput, true, scalars)
  }
  if (type.kind === 'object') {
    const fields = Object.entries(type.type).map(([fieldName, fieldT]) => {
      const fieldType = typeToGqlType(`${name}_${fieldName}`, fieldT, types, typeMap, typeRef, isInput, false, scalars)
      return `${fieldName}: ${fieldType}`
    })
    typeMap[name] = `${isInput ? 'input' : 'type'} ${name} {
        ${fields.join('\n        ')}
    }`
    return `${name}${isRequired}`
  }
  if (type.kind === 'enumerator') {
    typeMap[name] = `enum ${name} {
      ${type.values.join('\n        ')}
    }`
    return `${name}${isRequired}`
  }
  if (type.kind === 'union-operator') {
    if (
      (type.types.length === 2 && lazyToType(type.types[0]).kind === 'null') ||
      lazyToType(type.types[1]).kind === 'null'
    ) {
      return typeToGqlType(
        name,
        lazyToType(type.types[0]).kind === 'null' ? type.types[1] : type.types[0],
        types,
        typeMap,
        typeRef,
        isInput,
        true,
        scalars,
      )
    }
    typeMap[name] = `union ${name} = ${type.types
      .map((t, i) => typeToGqlType(`${name}_Union_${i}`, t, types, typeMap, typeRef, isInput, true, scalars))
      .join(' | ')}`
    return `${name}${isRequired}`
  }
  if (type.kind === 'null') {
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
  return assertNever(type)
}

function generateInputs({
  module,
  options,
  scalarsMap,
}: {
  module: GenericModule
  options: ModuleRunnerOptions
  scalarsMap: Record<string, CustomType>
}) {
  const typeMap: Record<string, string> = {}
  const typeRef: Map<Function, string> = new Map()
  const usedTypes = new Set([
    ...Object.values(module.operations.queries).map((q) => q.input),
    ...Object.values(module.operations.mutations).map((q) => q.input),
  ])
  for (const [name, type] of Object.entries(module.types).filter(([name]) => usedTypes.has(name))) {
    typeToGqlType(name, type, module.types, typeMap, typeRef, true, false, scalarsMap)
  }
  return Object.values(typeMap).join('\n\n')
}

function generateTypes({
  module,
  options,
  scalarsMap,
}: {
  module: GenericModule
  options: ModuleRunnerOptions
  scalarsMap: Record<string, CustomType>
}) {
  const typeMap: Record<string, string> = {}
  const typeRef: Map<Function, string> = new Map()
  const usedTypes = new Set([
    ...Object.values(module.operations.queries).map((q) => q.output),
    ...Object.values(module.operations.mutations).map((q) => q.output),
  ])
  for (const [name, type] of Object.entries(module.types).filter(([name]) => usedTypes.has(name))) {
    typeToGqlType(name, type, module.types, typeMap, typeRef, false, false, scalarsMap)
  }
  return Object.values(typeMap).join('\n\n')
}

function generateScalars({
  module,
  options,
  scalarsMap,
}: {
  module: GenericModule
  options: ModuleRunnerOptions
  scalarsMap: Record<string, CustomType>
}) {
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
  options,
  type,
}: {
  type: 'queries' | 'mutations'
  module: GenericModule
  options: ModuleRunnerOptions
}) {
  const ops = module.operations[type]
  const rsvs = module.resolvers[type]
  const resolvers = Object.fromEntries(
    Object.entries(ops).map(([operationName, operation]) => {
      const gqlInputTypeName = operation.options?.graphql?.inputName ?? 'input'
      const resolver = async (
        parent: unknown,
        input: Record<string, unknown>,
        context: unknown,
        info: GraphQLResolveInfo,
      ) => {
        const operationId = randomUUID().split('-').join('')
        //reply.header('operation-id', operationId) //TODO
        const decoded = decode(operation.types[operation.input], input[gqlInputTypeName], { cast: true })
        if (!decoded.pass) {
          if (options.graphql?.logger) {
            console.log(`[GQL-MODULE / ${type}.${operationName}]: Bad request. ID: ${operationId}`)
          }
          //reply.status(400)
          throw new Error(`Invalid input: ${JSON.stringify(decoded.errors)}`)
        }
        const startMs = new Date().getTime()
        const result = await rsvs[operationName].f({
          context: context as any,
          fields: info as any, // TODO
          input: decoded.value,
        })
        const encoded = encode(operation.types[operation.output], result)
        if (options.graphql?.logger) {
          console.log(
            `[GQL-MODULE / ${type}.${operationName}]: Completed in ${
              new Date().getTime() - startMs
            } ms. ID: ${operationId}`,
          )
        }
        return encoded
      }
      return [operationName, resolver]
    }),
  )
  const defs = Object.entries(ops)
    .map(([operationName, operation]) => {
      const inputType = lazyToType(module.types[operation.input])
      const gqlInputType = typeToGqlType(operation.input, inputType, module.types, {}, new Map(), true, false, {})
      const ouputType = lazyToType(module.types[operation.output])
      const gqlOutputType = typeToGqlType(operation.output, ouputType, module.types, {}, new Map(), true, false, {})
      return `${operationName}(${operation.options?.graphql?.inputName ?? 'input'}: ${gqlInputType}): ${gqlOutputType}`
    })
    .join('\n')
  return { defs, resolvers }
}

export function buildGraphqlSchema({
  module,
  options,
}: {
  module: GenericModule
  options: ModuleRunnerOptions
}): GraphQLSchema {
  const { defs: queryDefs, resolvers: queryResolvers } = generateQueryOrMutation({ module, options, type: 'queries' })
  const { defs: mutationDefs, resolvers: mutationResolvers } = generateQueryOrMutation({
    module,
    options,
    type: 'mutations',
  })
  const scalarsMap: Record<string, CustomType> = {}
  const typeDefs = generateTypes({ module, options, scalarsMap })
  const inputDefs = generateInputs({ module, options, scalarsMap })
  const { scalarDefs, scalarResolvers } = generateScalars({ module, options, scalarsMap })

  const schemaDefs = `
  ${scalarDefs}
  ${typeDefs}
  ${inputDefs}
  type Query {
    ${queryDefs}
  }
  type Mutation {
    ${mutationDefs}
  }
  `
  console.log(schemaDefs)
  const schema = createSchema({
    typeDefs: schemaDefs,
    resolvers: {
      Query: queryResolvers,
      Mutation: mutationResolvers,
      ...scalarResolvers,
    },
  })
  return schema
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
