import { module, utils } from '.'
import { decoding, types, validation } from '@mondrian-framework/model'
import { areJsonsEquals, mapObject } from '@mondrian-framework/utils'

/**
 * Converts a {@link module.ModuleInterface ModuleInterface} to a {@link ModuleSchema}.
 * It's useful to store a ModuleInterface as JSON or other formats.
 * @param moduleInterface the module interface.
 * @returns the module interface schema.
 */
export function serialize(moduleInterface: module.ModuleInterface): ModuleSchema {
  const { typeMap, nameMap } = serializeTypes(moduleInterface)
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
function serializeTypes(moduleInterface: module.ModuleInterface): {
  typeMap: Record<string, TypeSchema>
  nameMap: Map<types.Type, string>
} {
  const allTypes = Object.values(moduleInterface.functions).flatMap((f) => [f.input, f.output, f.error])
  const uniqueTypes = utils.allUniqueTypes(allTypes)
  const nameMap: Map<types.Type, string> = new Map()
  const typeMap: Record<string, TypeSchema> = {}
  for (const t of uniqueTypes.values()) {
    resolveTypeSerialization(t, nameMap, typeMap)
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
  const serializedType = serializeType(type, (subType) => resolveTypeSerialization(subType, nameMap, typeMap))
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
function serializeType(type: types.Type, resolve: (subType: types.Type) => string): TypeSchema {
  const concreteType = types.concretise(type)
  switch (concreteType.kind) {
    case types.Kind.String:
      return {
        string: {
          options: concreteType.options
            ? {
                ...concreteType.options,
                regex: concreteType.options.regex ? concreteType.options.regex.source : undefined,
              }
            : undefined,
        },
      }
    case types.Kind.Number:
      return { number: { options: concreteType.options } }
    case types.Kind.Boolean:
      return { boolean: { options: concreteType.options } }
    case types.Kind.Literal:
      return { literal: { literalValue: concreteType.literalValue, options: concreteType.options } }
    case types.Kind.Enum:
      return { enumerator: { variants: concreteType.variants, options: concreteType.options } }
    case types.Kind.Array:
      return { array: { wrappedType: resolve(concreteType.wrappedType), options: concreteType.options } }
    case types.Kind.Nullable:
      return { nullable: { wrappedType: resolve(concreteType.wrappedType), options: concreteType.options } }
    case types.Kind.Optional:
      return { optional: { wrappedType: resolve(concreteType.wrappedType), options: concreteType.options } }
    case types.Kind.Object:
      return {
        object: {
          fields: mapObject(concreteType.fields, (_, field: types.Field) =>
            'virtual' in field ? { type: resolve(field.virtual), virtual: true } : { type: resolve(field) },
          ),
          options: concreteType.options,
          lazy: typeof type === 'function' ? true : undefined,
        },
      }
    case types.Kind.Union:
      return {
        union: {
          variants: mapObject(concreteType.variants, (_, variantType: types.Type) => ({ type: resolve(variantType) })),
          options: concreteType.options,
          lazy: typeof type === 'function' ? true : undefined,
        },
      }
    case types.Kind.Custom:
      return {
        custom: {
          typeName: concreteType.typeName,
          options: concreteType.options
            ? {
                name: concreteType.options.name,
                description: concreteType.options.description,
                sensitive: concreteType.options.sensitive,
              } //TODO: at the moment every other options is erased. How to resolve?
            : undefined,
        },
      }
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
    const error = nameMap.get(functionInterface.error)!
    return { input, output, error, options: functionInterface.options }
  })
  return functionMap
}

const baseOptionsFields = {
  name: types.string({ minLength: 1 }).optional(),
  description: types.string().optional(),
  sensitive: types.boolean().optional(),
}
const stringTypeSchema = types.object({
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
  options: types.object(baseOptionsFields).optional(),
})
const literalTypeSchema = types.object({
  literalValue: types.custom<'literal-value', {}, string | number | boolean | null>(
    'literal-value',
    (v) => v,
    (v) => {
      if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean' || v === null) {
        return decoding.succeed(v)
      } else {
        return decoding.fail('string, number, boolean or null', v)
      }
    },
    (v) => validation.succeed(),
  ),
  options: types.object(baseOptionsFields).optional(),
})
const enumTypeSchema = types.object({
  variants: types.string().array(),
  options: types.object(baseOptionsFields).optional(),
})
const arrayTypeSchema = types.object({
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
  wrappedType: types.string(),
  options: types.object(baseOptionsFields).optional(),
})
const optionalTypeSchema = types.object({
  wrappedType: types.string(),
  options: types.object(baseOptionsFields).optional(),
})
const objectTypeSchema = types.object({
  fields: types.record(types.object({ type: types.string(), virtual: types.boolean().optional() })),
  lazy: types.boolean().optional(),
  options: types.object(baseOptionsFields).optional(),
})
const unionTypeSchema = types.object({
  variants: types.record(types.object({ type: types.string() })),
  lazy: types.boolean().optional(),
  options: types.object(baseOptionsFields).optional(),
})
const customTypeSchema = types.object({
  typeName: types.string(),
  options: types.object(baseOptionsFields).optional(),
})
const typeSchema = types.union({
  string: stringTypeSchema,
  number: numberTypeSchema,
  boolean: booleanTypeSchema,
  literal: literalTypeSchema,
  enumerator: enumTypeSchema,
  array: arrayTypeSchema,
  nullable: nullableTypeSchema,
  optional: optionalTypeSchema,
  object: objectTypeSchema,
  union: unionTypeSchema,
  custom: customTypeSchema,
})
type TypeSchema = types.Infer<typeof typeSchema>

const functionSchema = types
  .object({
    input: types.string({ minLength: 1 }),
    output: types.string({ minLength: 1 }),
    error: types.string({ minLength: 1 }),
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
