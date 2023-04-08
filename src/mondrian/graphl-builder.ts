import SchemaBuilder, { FieldRef, InputFieldRef, InputObjectRef, ObjectRef } from '@pothos/core'
import { GraphQLSchema, buildSchema, buildClientSchema, GraphQLResolveInfo } from 'graphql'
import { Module, ModuleRunnerOptions, Operations } from './mondrian'
import { lazyToType } from './utils'
import { LazyType, Types } from './type-system'
import { createSchema } from 'graphql-yoga'

function typeToGqlType(
  name: string,
  t: LazyType,
  typeMap: Record<string, string>,
  typeRef: Map<Function, string>,
  isInput: boolean,
  isOptional: boolean = false,
): string {
  const isRequired = isOptional ? '' : '!'
  if (typeof t === 'function') {
    const n = typeRef.get(t)
    if (n && n !== name) {
      return `${n}${isRequired}`
    }
    typeRef.set(t, name)
  }
  const type = lazyToType(t)
  if (type.kind === 'string') {
    return `String${isRequired}`
  }
  if (type.kind === 'date') {
    return `String${isRequired}` //TODO
  }
  if (type.kind === 'boolean') {
    return `Boolean${isRequired}`
  }
  if (type.kind === 'number') {
    return `Int${isRequired}`
  }
  if (type.kind === 'array-decorator') {
    return `[${typeToGqlType(name, type.type, typeMap, typeRef, isInput)}]${isRequired}`
  }
  if (type.kind === 'optional-decorator') {
    return typeToGqlType(name, type.type, typeMap, typeRef, isInput, true)
  }
  if (type.kind === 'object') {
    const fields = Object.entries(type.type).map(([fieldName, fieldT]) => {
      const fieldType = typeToGqlType(`${name}_${fieldName}`, fieldT, typeMap, typeRef, isInput)
      return `${fieldName}: ${fieldType}`
    })
    typeMap[name] = `${isInput ? 'input' : 'type'} ${name} {
        ${fields.join('\n        ')}
    }`
  }
  return `${name}${isRequired}`
}

export function buildGraphqlSchema<const T extends Types, const O extends Operations<T>, const Context>({
  module,
  options,
}: {
  module: Module<T, O, Context>
  options: ModuleRunnerOptions
}): GraphQLSchema {
  const Query = Object.fromEntries(
    Object.entries(module.operations.queries).map(([operationName, operation]) => {
      const gqlInputTypeName = operation.options?.graphql?.inputName ?? 'input'
      const resolver = (
        parent: unknown,
        input: Record<string, unknown>,
        context: unknown,
        info: GraphQLResolveInfo,
      ) => {
        return module.resolvers.queries[operationName].f({
          context: context as any, // TODO
          fields: info as any, // TODO
          input: input[gqlInputTypeName],
        })
      }
      return [operationName, resolver]
    }),
  )
  const typeMap: Record<string, string> = {}
  const typeRef: Map<Function, string> = new Map()
  const usedTypes = new Set([
    ...Object.values(module.operations.queries).map((q) => q.output),
    ...Object.values(module.operations.mutations).map((q) => q.output),
  ])
  for (const [name, type] of Object.entries(module.types).filter(([name]) => usedTypes.has(name))) {
    if (typeof type === 'function') {
      typeRef.set(type, name)
    }
  }
  for (const [name, type] of Object.entries(module.types).filter(([name]) => usedTypes.has(name))) {
    typeToGqlType(name, type, typeMap, typeRef, false)
  }
  const types = Object.values(typeMap).join('\n\n')
  const typeDefs = `${types}
  type Query {
      user(id: String!): User!
  }
  `
  console.log(typeDefs)
  const schema = createSchema({
    typeDefs,
    resolvers: {
      Query,
    },
  })

  return schema
  /*
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
}
