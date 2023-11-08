import { decoding, path, types, validation } from '../../'
import { prependFieldToAll } from '../../utils'
import { DefaultMethods } from './base'
import { JSONType, filterMapObject } from '@mondrian-framework/utils'
import gen from 'fast-check'

/**
 * @param types an entity where each field is itself a {@link types.Type}, used to determine the structure of the
 *              new `EntityType`
 * @param options the {@link types.EntityTypeOptions} used to define the new `EntityType`
 * @returns an {@link types.EntityType} with the provided values
 * @example Imagine you are modelling a `User` that has a username, an age and a boolean flag to tell if it is an admin
 *          or not. Its definition could look like this:
 *
 *          ```ts
 *          type User = Infer<typeof user>
 *          const user = entity(
 *            {
 *              username: string(),
 *              age: number(),
 *              isAdmin: boolean(),
 *            },
 *            {
 *              name: 'user',
 *              description: 'a user with an age and a username',
 *            },
 *          )
 *
 *          const exampleUser: User = {
 *            username: 'Giacomo',
 *            age: 24,
 *            isAdmin: false,
 *          }
 *          ```
 */
export function entity<Ts extends types.Types>(
  fields: Ts,
  options?: types.EntityTypeOptions,
): types.EntityType<types.Mutability.Immutable, Ts> {
  return new EntityTypeImpl(types.Mutability.Immutable, fields, options)
}

export function mutableEntity<Ts extends types.Types>(
  fields: Ts,
  options?: types.EntityTypeOptions,
): types.EntityType<types.Mutability.Mutable, Ts> {
  return new EntityTypeImpl(types.Mutability.Mutable, fields, options)
}

class EntityTypeImpl<M extends types.Mutability, Ts extends types.Types>
  extends DefaultMethods<types.EntityType<M, Ts>>
  implements types.EntityType<M, Ts>
{
  readonly kind = types.Kind.Entity
  readonly mutability: M
  readonly fields: Ts

  getThis = () => this
  fromOptions = (options: types.EntityTypeOptions) => new EntityTypeImpl(this.mutability, this.fields, options)

  immutable = () => entity(this.fields, this.options)
  mutable = () => mutableEntity(this.fields, this.options)

  constructor(mutability: M, fields: Ts, options?: types.EntityTypeOptions) {
    super(options)
    this.mutability = mutability
    this.fields = fields
  }

  encodeWithNoChecks(value: types.Infer<types.EntityType<M, Ts>>): JSONType {
    const entity = value as Record<string, types.Type>
    return filterMapObject(this.fields, (fieldName, fieldType) => {
      const concreteFieldType = types.concretise(fieldType)
      const fieldIsOptional = types.isOptional(concreteFieldType)
      const rawField = entity[fieldName]
      const encodedField = concreteFieldType.encodeWithoutValidation(rawField as never)
      return fieldIsOptional && encodedField === null ? undefined : encodedField
    })
  }

  validate(value: types.Infer<types.EntityType<M, Ts>>, validationOptions?: validation.Options): validation.Result {
    const options = { ...validation.defaultOptions, ...validationOptions }
    const entries = Object.entries(value)
    const errors: validation.Error[] = []
    for (const [fieldName, fieldValue] of entries) {
      if (errors.length > 0 && options.errorReportingStrategy === 'stopAtFirstError') {
        break
      }
      const concreteFieldType = types.concretise(this.fields[fieldName])
      const result = concreteFieldType.validate(fieldValue as never, options)
      if (!result.isOk) {
        errors.push(...prependFieldToAll(result.error, fieldName))
      }
    }
    if (errors.length > 0) {
      return validation.failWithErrors(errors)
    } else {
      return validation.succeed()
    }
  }

  decodeWithoutValidation(
    value: unknown,
    decodingOptions?: decoding.Options,
  ): decoding.Result<types.Infer<types.EntityType<M, Ts>>> {
    return castToEntity(value, decodingOptions).chain((entity) =>
      decodeEntityProperties(this.fields, entity, decodingOptions),
    )
  }

  arbitrary(maxDepth: number): gen.Arbitrary<types.Infer<types.ObjectType<M, Ts>>> {
    const entriesGenerators = Object.fromEntries(
      Object.entries(this.fields).map(
        ([fieldName, fieldType]: [string, types.Type]) =>
          [fieldName, types.concretise(fieldType).arbitrary(maxDepth - 1)] as const,
      ),
    )
    return gen.record(entriesGenerators) as gen.Arbitrary<types.Infer<types.ObjectType<M, Ts>>>
  }
}

function castToEntity(value: unknown, decodingOptions?: decoding.Options): decoding.Result<Record<string, unknown>> {
  if (typeof value === 'object') {
    if (value === null && decodingOptions?.typeCastingStrategy !== 'tryCasting') {
      return decoding.fail('entity', null)
    }
    return decoding.succeed((value ?? {}) as Record<string, unknown>)
  } else {
    return decoding.fail('entity', value)
  }
}

function decodeEntityProperties(
  fields: types.Types,
  entity: Record<string, unknown>,
  decodingOptions?: decoding.Options,
): decoding.Result<any> {
  const keySet = new Set([...Object.keys(fields), ...Object.keys(entity)])
  const errors: decoding.Error[] = []
  const result: Record<string, unknown> = {}
  for (const key of keySet) {
    if (errors.length > 0 && decodingOptions?.errorReportingStrategy !== 'allErrors') {
      break
    }
    const type = fields[key]
    const value = entity[key]
    if (type === undefined && value === undefined) {
      continue
    } else if (!type && decodingOptions?.fieldStrictness === 'expectExactFields') {
      errors.push({ expected: 'undefined', got: value, path: path.empty().prependField(key) })
      continue
    } else if (!type) {
      continue
    }
    const decodedValue = types.concretise(type).decodeWithoutValidation(value, decodingOptions)
    if (decodedValue.isOk) {
      result[key] = decodedValue.value
    } else {
      errors.push(...prependFieldToAll(decodedValue.error, key))
    }
  }
  if (errors.length > 0) {
    return decoding.failWithErrors(errors)
  } else {
    return decoding.succeed(result)
  }
}
