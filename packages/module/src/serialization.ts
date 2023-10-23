import { module, utils } from '.'
import { result, types, validation } from '@mondrian-framework/model'
import { JSONType, areJsonsEquals, assertNever, mapObject } from '@mondrian-framework/utils'
import gen from 'fast-check'

/**
 * Specify how a custom type should be serialized.
 */
export type CustomSerializer = (
  /**
   * type to serialize
   */
  custom: types.CustomType<any, any, any>,
  /**
   * this utility resolve any sub-type if needed.
   * Takes the sub-type(s) of this custom type and returns the reference name.
   */
  resolve: (type: types.Type) => string,
) => JSONType
export type CustomSerializers = { readonly [key in string]?: CustomSerializer }

/**
 * Default custom serializer for known types.
 */
const defaultCustomSerializers: CustomSerializers = {
  record: (custom: types.RecordType<types.Type>, resolve) => ({
    wrappedType: resolve(custom.options!.fieldsType),
  }),
  datetime: (custom: types.DateTimeType) => ({
    customOptions: {
      minimum: custom.options?.minimum?.getTime(),
      maximum: custom.options?.maximum?.getTime(),
    },
  }),
  timestamp: (custom: types.TimestampType) => ({
    customOptions: {
      minimum: custom.options?.minimum?.getTime(),
      maximum: custom.options?.maximum?.getTime(),
    },
  }),
}

/**
 * Converts a {@link module.ModuleInterface ModuleInterface} to a {@link ModuleSchema}.
 * It's useful to store a ModuleInterface as JSON or other formats.
 * @param moduleInterface the module interface.
 * @returns the module interface schema.
 */
export function serialize(
  moduleInterface: module.ModuleInterface,
  customSerializers?: CustomSerializers,
): ModuleSchema {
  const { typeMap, nameMap } = serializeTypes(moduleInterface, customSerializers ?? defaultCustomSerializers)
  const functionMap = serializeFunctions(moduleInterface, nameMap)
  return {
    name: moduleInterface.name,
    version: moduleInterface.version,
    types: typeMap,
    functions: functionMap,
  }
}

/**
 * Serialize all types in a map [type name] -> [type schema].
 * For types without names an incremental name is used: `ANONYMOUS_TYPE_${n}`
 */
function serializeTypes(
  moduleInterface: module.ModuleInterface,
  customSerializers: CustomSerializers,
): {
  typeMap: Record<string, TypeSchema>
  nameMap: Map<types.Type, string>
} {
  const allTypes = Object.values(moduleInterface.functions).flatMap((f) =>
    f.error ? [f.input, f.output, f.error] : [f.input, f.output],
  )
  const uniqueTypes = utils.allUniqueTypes(allTypes)
  const nameMap: Map<types.Type, string> = new Map()
  const typeMap: Record<string, TypeSchema> = {}
  for (const t of uniqueTypes.values()) {
    resolveTypeSerialization(t, nameMap, typeMap, customSerializers)
  }
  return { typeMap, nameMap }
}

/**
 * For the given type checks if it was alredy serialized.
 * If not the serialization is added to the maps and serialize also all subtypes.
 */
function resolveTypeSerialization(
  type: types.Type,
  nameMap: Map<types.Type, string>,
  typeMap: Record<string, TypeSchema>,
  customSerializers: CustomSerializers,
): string {
  const cachedName = nameMap.get(type)
  if (cachedName !== undefined) {
    return cachedName
  }
  const concreteType = types.concretise(type)
  const name =
    concreteType.options?.name ??
    `ANONYMOUS_TYPE_${Object.keys(typeMap).filter((k) => k.startsWith('ANONYMOUS_TYPE_')).length}`
  nameMap.set(type, name)
  const serializedType = serializeType(
    type,
    (subType) => resolveTypeSerialization(subType, nameMap, typeMap, customSerializers),
    customSerializers,
  )
  const existingType = Object.entries(typeMap).find(([_, type]) => areJsonsEquals(type, serializedType))
  if (existingType) {
    const [existingTypeName] = existingType
    nameMap.set(type, existingTypeName)
    return existingTypeName
  } else {
    typeMap[name] = serializedType
    return name
  }
}

/**
 * Serializes any type to it's schema.
 * @param type the type to serialize
 * @param resolve this function must be like a map [type] -> [type name]
 */
function serializeType(
  type: types.Type,
  resolve: (subType: types.Type) => string,
  customSerializers: CustomSerializers,
): TypeSchema {
  const concreteType = types.concretise(type)
  switch (concreteType.kind) {
    case types.Kind.String:
      return {
        string: {
          type: 'string',
          options: concreteType.options
            ? {
                ...concreteType.options,
                regex: concreteType.options.regex ? concreteType.options.regex.source : undefined,
              }
            : undefined,
        },
      }
    case types.Kind.Number:
      return { number: { type: 'number', options: concreteType.options } }
    case types.Kind.Boolean:
      return { boolean: { type: 'boolean', options: concreteType.options } }
    case types.Kind.Literal:
      const literalValue =
        concreteType.literalValue === null
          ? { null: null }
          : typeof concreteType.literalValue === 'string'
          ? { string: concreteType.literalValue }
          : typeof concreteType.literalValue === 'number'
          ? { number: concreteType.literalValue }
          : { boolean: concreteType.literalValue as boolean }
      return { literal: { type: 'literal', literalValue, options: concreteType.options } }
    case types.Kind.Enum:
      return { enumeration: { type: 'enumeration', variants: concreteType.variants, options: concreteType.options } }
    case types.Kind.Array:
      return { array: { type: 'array', wrappedType: resolve(concreteType.wrappedType), options: concreteType.options } }
    case types.Kind.Nullable:
      return {
        nullable: { type: 'nullable', wrappedType: resolve(concreteType.wrappedType), options: concreteType.options },
      }
    case types.Kind.Optional:
      return {
        optional: { type: 'optional', wrappedType: resolve(concreteType.wrappedType), options: concreteType.options },
      }
    case types.Kind.Object:
      return {
        object: {
          type: 'object',
          fields: mapObject(concreteType.fields, (_, field: types.Type) => resolve(field)),
          options: concreteType.options,
          lazy: typeof type === 'function' ? true : undefined,
        },
      }
    case types.Kind.Entity:
      return {
        entity: {
          type: 'entity',
          fields: mapObject(concreteType.fields, (_, field: types.Type) => resolve(field)),
          options: concreteType.options,
          lazy: typeof type === 'function' ? true : undefined,
        },
      }
    case types.Kind.Union:
      return {
        union: {
          type: 'union',
          variants: mapObject(concreteType.variants, (_, variantType: types.Type) => ({ type: resolve(variantType) })),
          options: concreteType.options,
          lazy: typeof type === 'function' ? true : undefined,
        },
      }
    case types.Kind.Custom:
      const customSerializer = customSerializers[concreteType.typeName]
      const customSerialization = customSerializer ? customSerializer(concreteType, (type) => resolve(type)) : undefined
      return {
        custom: {
          type: 'custom',
          typeName: concreteType.typeName,
          options: concreteType.options
            ? {
                name: concreteType.options.name,
                description: concreteType.options.description,
                sensitive: concreteType.options.sensitive,
              }
            : undefined,
          custom: customSerialization,
        },
      }
    default:
      assertNever(concreteType)
  }
}

/**
 * Serializes all functions of a mondrian interface.
 * It needs the map of serialized types.
 */
function serializeFunctions(
  moduleInterface: module.ModuleInterface,
  nameMap: Map<types.Type, string>,
): Record<string, FunctionSchema> {
  const functionMap = mapObject(moduleInterface.functions, (_, functionInterface) => {
    const input = nameMap.get(functionInterface.input)!
    const output = nameMap.get(functionInterface.output)!
    if (functionInterface.error) {
      const error = nameMap.get(functionInterface.error)!
      return { input, output, error, options: functionInterface.options }
    } else {
      return { input, output, options: functionInterface.options }
    }
  })
  return functionMap
}

const baseOptionsFields = {
  name: types.string({ minLength: 1 }).optional(),
  description: types.string().optional(),
  sensitive: types.boolean().optional(),
}
const stringTypeSchema = types.object({
  type: types.literal('string'),
  options: types
    .object({
      ...baseOptionsFields,
      minLength: types.integer({ minimum: 0 }).optional(),
      maxLength: types.integer({ minimum: 0 }).optional(),
      regex: types.string().optional(),
    })
    .optional(),
})
const numberTypeSchema = types.object({
  type: types.literal('number'),
  options: types
    .object({
      ...baseOptionsFields,
      isInteger: types.boolean().optional(),
      minimum: types.number().optional(),
      exclusiveMinimum: types.number().optional(),
      maximum: types.number().optional(),
      exclusiveMaximum: types.number().optional(),
    })
    .optional(),
})
const booleanTypeSchema = types.object({
  type: types.literal('boolean'),
  options: types.object(baseOptionsFields).optional(),
})
const literalTypeSchema = types.object({
  type: types.literal('literal'),
  literalValue: types.union({
    null: types.literal(null),
    string: types.string(),
    boolean: types.boolean(),
    number: types.number(),
  }),
  options: types.object(baseOptionsFields).optional(),
})
const enumTypeSchema = types.object({
  type: types.literal('enumeration'),
  variants: types.string().array(),
  options: types.object(baseOptionsFields).optional(),
})
const arrayTypeSchema = types.object({
  type: types.literal('array'),
  wrappedType: types.string(),
  options: types
    .object({
      ...baseOptionsFields,
      minItems: types.integer({ minimum: 0 }).optional(),
      maxItems: types.integer({ minimum: 0 }).optional(),
    })
    .optional(),
})
const nullableTypeSchema = types.object({
  type: types.literal('nullable'),
  wrappedType: types.string(),
  options: types.object(baseOptionsFields).optional(),
})
const optionalTypeSchema = types.object({
  type: types.literal('optional'),
  wrappedType: types.string(),
  options: types.object(baseOptionsFields).optional(),
})
const objectTypeSchema = types.object({
  type: types.literal('object'),
  fields: types.record(types.string()),
  lazy: types.boolean().optional(),
  options: types.object(baseOptionsFields).optional(),
})
const entityTypeSchema = types.object({
  type: types.literal('entity'),
  fields: types.record(types.string()),
  lazy: types.boolean().optional(),
  options: types.object(baseOptionsFields).optional(),
})
const unionTypeSchema = types.object({
  type: types.literal('union'),
  variants: types.record(types.object({ type: types.string() })),
  lazy: types.boolean().optional(),
  options: types.object(baseOptionsFields).optional(),
})
const customTypeSchema = types.object({
  type: types.literal('custom'),
  typeName: types.string(),
  options: types.object(baseOptionsFields).optional(),
  custom: types
    .custom<'json', {}, JSONType>(
      'json',
      (v) => v,
      (v) => (v === undefined ? result.ok(null) : result.ok(v as JSONType)),
      () => validation.succeed(),
      () => gen.constant({}),
    )
    .optional(),
})
const typeSchema = types
  .union(
    {
      string: stringTypeSchema,
      number: numberTypeSchema,
      boolean: booleanTypeSchema,
      literal: literalTypeSchema,
      enumeration: enumTypeSchema,
      array: arrayTypeSchema,
      nullable: nullableTypeSchema,
      optional: optionalTypeSchema,
      object: objectTypeSchema,
      entity: entityTypeSchema,
      union: unionTypeSchema,
      custom: customTypeSchema,
    },
    { useTags: false },
  )
  .setName('TypeSchema')
type TypeSchema = types.Infer<typeof typeSchema>

const functionSchema = types
  .object({
    input: types.string({ minLength: 1 }),
    output: types.string({ minLength: 1 }),
    error: types.string({ minLength: 1 }).optional(),
    options: types
      .object({
        namespace: types.string().optional(),
        description: types.string().optional(),
      })
      .optional(),
  })
  .setName('FunctionSchema')
type FunctionSchema = types.Infer<typeof functionSchema>

/**
 * The mondrian type of a {@link module.ModuleInterface ModuleInterface} schema.
 * A schema containts all the information about the functions signatures and types.
 * Does not contains any implementation details (e.g. the CustomTypes implementation or functions bodies).
 */
export const moduleSchema = types
  .object({
    name: types.string({ minLength: 1 }),
    version: types.string(),
    types: types.record(typeSchema),
    functions: types.record(functionSchema),
  })
  .setName('ModuleSchema')

/**
 * The type of a {@link module.ModuleInterface ModuleInterface} schema.
 */
export type ModuleSchema = types.Infer<typeof moduleSchema>
