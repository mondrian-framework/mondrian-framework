import { module, utils } from '.'
import { result, model, validation } from '@mondrian-framework/model'
import { JSONType, areJsonsEquals, assertNever, mapObject } from '@mondrian-framework/utils'
import gen from 'fast-check'

/**
 * Specify how a custom type should be serialized.
 */
export type CustomSerializer = (
  /**
   * type to serialize
   */
  custom: model.CustomType<any, any, any>,
  /**
   * this utility resolve any sub-type if needed.
   * Takes the sub-type(s) of this custom type and returns the reference name.
   */
  resolve: (type: model.Type) => string,
) => JSONType
export type CustomSerializers = { readonly [key in string]?: CustomSerializer }

/**
 * Default custom serializer for known types.
 */
const defaultCustomSerializers: CustomSerializers = {
  record: (custom: model.RecordType<model.Type>, resolve) => ({
    wrappedType: resolve(custom.options!.fieldsType),
  }),
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
  nameMap: Map<model.Type, string>
} {
  const allTypes = Object.values(moduleInterface.functions).flatMap((f) =>
    f.errors ? [f.input, f.output, ...Object.values(f.errors)] : [f.input, f.output],
  )
  const uniqueTypes = utils.allUniqueTypes(allTypes)
  const nameMap: Map<model.Type, string> = new Map()
  const typeMap: Record<string, TypeSchema> = {}
  for (const t of uniqueTypes.values()) {
    resolveTypeSerialization(t, nameMap, typeMap, customSerializers)
  }
  return { typeMap, nameMap }
}

/**
 * For the given type checks if it was alredy serialized.
 * If not the serialization is added to the maps and serialize also all submodel.
 */
function resolveTypeSerialization(
  type: model.Type,
  nameMap: Map<model.Type, string>,
  typeMap: Record<string, TypeSchema>,
  customSerializers: CustomSerializers,
): string {
  const cachedName = nameMap.get(type)
  if (cachedName !== undefined) {
    return cachedName
  }
  const concreteType = model.concretise(type)
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
  type: model.Type,
  resolve: (subType: model.Type) => string,
  customSerializers: CustomSerializers,
): TypeSchema {
  const concreteType = model.concretise(type)
  switch (concreteType.kind) {
    case model.Kind.String:
      return {
        type: 'string',
        options: concreteType.options
          ? {
              ...concreteType.options,
              regex: concreteType.options.regex ? concreteType.options.regex.source : undefined,
            }
          : undefined,
      }
    case model.Kind.Number:
      return { type: 'number', options: concreteType.options }
    case model.Kind.Boolean:
      return { type: 'boolean', options: concreteType.options }
    case model.Kind.Literal:
      return { type: 'literal', literalValue: concreteType.literalValue, options: concreteType.options }
    case model.Kind.Enum:
      return { type: 'enumeration', variants: concreteType.variants, options: concreteType.options }
    case model.Kind.Array:
      return { type: 'array', wrappedType: resolve(concreteType.wrappedType), options: concreteType.options }
    case model.Kind.Nullable:
      return {
        type: 'nullable',
        wrappedType: resolve(concreteType.wrappedType),
        options: concreteType.options,
      }
    case model.Kind.Optional:
      return {
        type: 'optional',
        wrappedType: resolve(concreteType.wrappedType),
        options: concreteType.options,
      }
    case model.Kind.Object:
      return {
        type: 'object',
        fields: mapObject(concreteType.fields, (_, field: model.Type) => resolve(field)),
        options: concreteType.options,
        lazy: typeof type === 'function' ? true : undefined,
      }
    case model.Kind.Entity:
      return {
        type: 'entity',
        fields: mapObject(concreteType.fields, (_, field: model.Type) => resolve(field)),
        options: concreteType.options,
        lazy: typeof type === 'function' ? true : undefined,
      }
    case model.Kind.Union:
      return {
        type: 'union',
        variants: mapObject(concreteType.variants, (_, variantType: model.Type) => ({ type: resolve(variantType) })),
        options: concreteType.options,
        lazy: typeof type === 'function' ? true : undefined,
      }
    case model.Kind.Custom:
      const customSerializer = customSerializers[concreteType.typeName]
      const customSerialization = customSerializer ? customSerializer(concreteType, (type) => resolve(type)) : undefined
      return {
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
      }
    default:
      assertNever(concreteType, `Unexpected model kind in serialization!`)
  }
}

/**
 * Serializes all functions of a mondrian interface.
 * It needs the map of serialized types.
 */
function serializeFunctions(
  moduleInterface: module.ModuleInterface,
  nameMap: Map<model.Type, string>,
): Record<string, FunctionSchema> {
  const functionMap = mapObject(moduleInterface.functions, (_, functionInterface) => {
    const input = nameMap.get(functionInterface.input)!
    const output = nameMap.get(functionInterface.output)!
    if (functionInterface.errors) {
      const errors = mapObject(functionInterface.errors, (_, errorType) => nameMap.get(errorType)!)
      return { input, output, errors, options: functionInterface.options }
    } else {
      return { input, output, options: functionInterface.options }
    }
  })
  return functionMap
}

const baseOptionsFields = {
  name: model.string({ minLength: 1 }).optional(),
  description: model.string().optional(),
  sensitive: model.boolean().optional(),
}
const stringTypeSchema = model.object({
  type: model.literal('string'),
  options: model
    .object({
      ...baseOptionsFields,
      minLength: model.integer({ minimum: 0 }).optional(),
      maxLength: model.integer({ minimum: 0 }).optional(),
      regex: model.string().optional(),
    })
    .optional(),
})
const numberTypeSchema = model.object({
  type: model.literal('number'),
  options: model
    .object({
      ...baseOptionsFields,
      isInteger: model.boolean().optional(),
      minimum: model.number().optional(),
      exclusiveMinimum: model.number().optional(),
      maximum: model.number().optional(),
      exclusiveMaximum: model.number().optional(),
    })
    .optional(),
})
const booleanTypeSchema = model.object({
  type: model.literal('boolean'),
  options: model.object(baseOptionsFields).optional(),
})
const literalTypeSchema = model.object({
  type: model.literal('literal'),
  literalValue: model.union({
    null: model.literal(null),
    string: model.string(),
    boolean: model.boolean(),
    number: model.number(),
  }),
  options: model.object(baseOptionsFields).optional(),
})
const enumTypeSchema = model.object({
  type: model.literal('enumeration'),
  variants: model.string().array(),
  options: model.object(baseOptionsFields).optional(),
})
const arrayTypeSchema = model.object({
  type: model.literal('array'),
  wrappedType: model.string(),
  options: model
    .object({
      ...baseOptionsFields,
      minItems: model.integer({ minimum: 0 }).optional(),
      maxItems: model.integer({ minimum: 0 }).optional(),
    })
    .optional(),
})
const nullableTypeSchema = model.object({
  type: model.literal('nullable'),
  wrappedType: model.string(),
  options: model.object(baseOptionsFields).optional(),
})
const optionalTypeSchema = model.object({
  type: model.literal('optional'),
  wrappedType: model.string(),
  options: model.object(baseOptionsFields).optional(),
})
const objectTypeSchema = model.object({
  type: model.literal('object'),
  fields: model.record(model.string()),
  lazy: model.boolean().optional(),
  options: model.object(baseOptionsFields).optional(),
})
const entityTypeSchema = model.object({
  type: model.literal('entity'),
  fields: model.record(model.string()),
  lazy: model.boolean().optional(),
  options: model.object(baseOptionsFields).optional(),
})
const unionTypeSchema = model.object({
  type: model.literal('union'),
  variants: model.record(model.object({ type: model.string() })),
  lazy: model.boolean().optional(),
  options: model.object(baseOptionsFields).optional(),
})
const customTypeSchema = model.object({
  type: model.literal('custom'),
  typeName: model.string(),
  options: model.object(baseOptionsFields).optional(),
  custom: model
    .custom<'json', {}, JSONType>(
      'json',
      (v) => v,
      (v) => (v === undefined ? result.ok(null) : result.ok(v as JSONType)),
      () => validation.succeed(),
      () => gen.constant({}),
    )
    .optional(),
})
const TypeSchema = model
  .union({
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
  })
  .setName('TypeSchema')
type TypeSchema = model.Infer<typeof TypeSchema>

const FunctionSchema = model
  .object({
    input: model.string({ minLength: 1 }),
    output: model.string({ minLength: 1 }),
    errors: model.record(model.string({ minLength: 1 })).optional(),
    retrieve: model
      .object({
        where: model.literal(true).optional(),
        select: model.literal(true).optional(),
        orderBy: model.literal(true).optional(),
        take: model.literal(true).optional(),
        skip: model.literal(true).optional(),
      })
      .optional(),
    options: model
      .object({
        namespace: model.string().optional(),
        description: model.string().optional(),
      })
      .optional(),
  })
  .setName('FunctionSchema')
type FunctionSchema = model.Infer<typeof FunctionSchema>

/**
 * The mondrian type of a {@link module.ModuleInterface ModuleInterface} schema.
 * A schema containts all the information about the functions signatures and types.
 * Does not contains any implementation details (e.g. the CustomTypes implementation or functions bodies).
 */
export const ModuleSchema = model
  .object({
    name: model.string({ minLength: 1 }),
    version: model.string(),
    types: model.record(TypeSchema),
    functions: model.record(FunctionSchema),
  })
  .setName('ModuleSchema')

/**
 * The type of a {@link module.ModuleInterface ModuleInterface} schema.
 */
export type ModuleSchema = model.Infer<typeof ModuleSchema>
