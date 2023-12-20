import { module } from '.'
import { ModuleSchema, TypeSchema } from './serialization'
import { model } from '@mondrian-framework/model'
import { assertNever, mapObject } from '@mondrian-framework/utils'

type CustomParser = (options: Record<string, unknown>, types: Record<string, model.Type>) => model.Type
export type CustomParsers = { readonly [key in string]?: CustomParser }

const defaultCustomParsers: CustomParsers = {
  record: (options, types) => model.record(() => types['a']),
  datetime: (custom: model.DateTimeType) => ({
    customOptions: {
      minimum: custom.options?.minimum?.getTime(),
      maximum: custom.options?.maximum?.getTime(),
    },
  }),
  timestamp: (custom: model.TimestampType) => ({
    customOptions: {
      minimum: custom.options?.minimum?.getTime(),
      maximum: custom.options?.maximum?.getTime(),
    },
  }),
}

export function parse({ name, version, types, functions }: ModuleSchema): module.ModuleInterface {
  return module.define({
    name,
    version,
    functions: {},
  })
}

function parseTypes(types: Record<string, TypeSchema>): Record<string, model.Type> {
  const results: Record<string, model.Type> = {}
  for (const [typeName, typeSchema] of Object.entries(types)) {
    results[typeName] = () => parseType(typeSchema, results)
  }
  return results
}

function parseType(type: TypeSchema, types: Record<string, model.Type>): model.Type {
  if (type.type === 'string') {
    return model.string({ ...type.options, regex: type.options?.regex ? new RegExp(type.options.regex) : undefined })
  } else if (type.type === 'number') {
    return model.number(type.options)
  } else if (type.type === 'boolean') {
    return model.boolean(type.options)
  } else if (type.type === 'literal') {
    return model.literal(type.literalValue, type.options)
  } else if (type.type === 'enumeration') {
    return model.enumeration(type.variants as [string, ...string[]], type.options)
  } else if (type.type === 'optional') {
    return model.optional(() => types[type.wrappedType], type.options)
  } else if (type.type === 'nullable') {
    return model.nullable(() => types[type.wrappedType], type.options)
  } else if (type.type === 'array') {
    return model.array(() => types[type.wrappedType], type.options)
  } else if (type.type === 'object') {
    return model.object(
      mapObject(type.fields, (_, fieldType) => () => types[fieldType]),
      type.options,
    )
  } else if (type.type === 'entity') {
    return model.entity(
      mapObject(type.fields, (_, fieldType) => () => types[fieldType]),
      type.options,
    )
  } else if (type.type === 'union') {
    return model.union(
      mapObject(type.variants, (_, fieldType) => () => types[fieldType]),
      type.options,
    )
  } else if (type.type === 'custom') {
  } else {
    assertNever(type, `Unexpected type ${type} on deserialization`)
  }
}
