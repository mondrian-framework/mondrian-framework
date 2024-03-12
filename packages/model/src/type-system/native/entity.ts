import { decoding, path, model, validation, encoding, utils } from '../..'
import { assertSafeObjectFields } from '../../utils'
import { BaseType } from './base'
import { JSONType, filterMapObject } from '@mondrian-framework/utils'
import gen from 'fast-check'

/**
 * @param types an entity where each field is itself a {@link model.Type}, used to determine the structure of the
 *              new `EntityType`
 * @param options the {@link model.EntityTypeOptions} used to define the new `EntityType`
 * @returns an {@link model.EntityType} with the provided values
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
 *            username: 'John',
 *            age: 24,
 *            isAdmin: false,
 *          }
 *          ```
 */
export function entity<Ts extends utils.RichFields>(
  fields: Ts,
  options?: SpecificOptions<Ts>,
): model.EntityType<model.Mutability.Immutable, utils.RichFieldsToTypes<Ts>> {
  const { fields: fieldsOptions, types } = utils.richFieldsToTypes(fields)
  return new EntityTypeImpl(
    model.Mutability.Immutable,
    types,
    fieldsOptions ? { ...options, fields: fieldsOptions } : options,
  )
}

export function mutableEntity<Ts extends utils.RichFields>(
  fields: Ts,
  options?: SpecificOptions<Ts>,
): model.EntityType<model.Mutability.Mutable, utils.RichFieldsToTypes<Ts>> {
  const { fields: fieldsOptions, types } = utils.richFieldsToTypes(fields)
  return new EntityTypeImpl(
    model.Mutability.Mutable,
    types,
    fieldsOptions ? { ...options, fields: fieldsOptions } : options,
  )
}

type SpecificOptions<Ts extends utils.RichFields> = Omit<model.EntityTypeOptions, 'fields' | 'retrieve'> & {
  readonly retrieve?: SpecificRetrieveCapabilities<Ts>
}

type SpecificRetrieveCapabilities<Ts extends utils.RichFields> = {
  readonly take?: true | { readonly max: number }
  readonly skip?: true | { readonly max: number }
  readonly where?: true | { [K in keyof Ts | 'AND' | 'OR' | 'NOT']?: boolean }
  readonly orderBy?: true | { [K in keyof Ts | 'AND' | 'OR' | 'NOT']?: boolean }
}

class EntityTypeImpl<M extends model.Mutability, Ts extends model.Types>
  extends BaseType<model.EntityType<M, Ts>>
  implements model.EntityType<M, Ts>
{
  readonly kind = model.Kind.Entity
  readonly mutability: M
  readonly fields: Ts

  protected getThis = () => this
  protected fromOptions = (options: model.EntityTypeOptions) =>
    new EntityTypeImpl(this.mutability, this.fields, options)

  immutable = () => entity(this.fields, this.options) as any
  mutable = () => mutableEntity(this.fields, this.options) as any

  constructor(mutability: M, fields: Ts, options?: model.EntityTypeOptions) {
    super(options)
    assertSafeObjectFields(fields)
    this.mutability = mutability
    this.fields = fields
  }

  protected encodeWithoutValidationInternal(
    value: model.Infer<model.EntityType<M, Ts>>,
    options: Required<encoding.Options>,
  ): JSONType {
    const entity = value as Record<string, model.Type>
    return filterMapObject(this.fields, (fieldName, fieldType) => {
      const concreteFieldType = model.concretise(fieldType)
      const fieldIsOptional = model.isOptional(concreteFieldType) || model.isLiteral(concreteFieldType, undefined)
      const rawField = entity[fieldName]
      return fieldIsOptional && rawField === undefined
        ? undefined
        : concreteFieldType.encodeWithoutValidation(rawField as never, options)
    })
  }

  protected validateInternal(
    value: model.Infer<model.EntityType<M, Ts>>,
    options: Required<validation.Options>,
  ): validation.Result {
    const entries = Object.entries(value)
    const errors: validation.Error[] = []
    for (const [fieldName, fieldValue] of entries) {
      if (errors.length > 0 && options.errorReportingStrategy === 'stopAtFirstError') {
        break
      }
      const concreteFieldType = model.concretise(this.fields[fieldName])
      const result = concreteFieldType.validate(fieldValue as never, options)
      if (result.isFailure) {
        errors.push(...path.prependFieldToAll(result.error, fieldName))
      }
    }
    if (errors.length > 0) {
      return validation.failWithErrors(errors)
    } else {
      return validation.succeed()
    }
  }

  protected decodeWithoutValidationInternal(
    value: unknown,
    options: Required<decoding.Options>,
  ): decoding.Result<model.Infer<model.EntityType<M, Ts>>> {
    return castToEntity(value, options).chain((entity) => decodeEntityProperties(this.fields, entity, options))
  }

  arbitraryInternal(maxDepth: number): gen.Arbitrary<model.Infer<model.ObjectType<M, Ts>>> {
    const entriesGenerators = Object.fromEntries(
      Object.entries(this.fields).map(
        ([fieldName, fieldType]: [string, model.Type]) =>
          [fieldName, model.concretise(fieldType).arbitrary(maxDepth - 1)] as const,
      ),
    )
    return gen.record(entriesGenerators) as gen.Arbitrary<model.Infer<model.ObjectType<M, Ts>>>
  }
}

function castToEntity(value: unknown, options: Required<decoding.Options>): decoding.Result<Record<string, unknown>> {
  if (typeof value !== 'object') {
    return decoding.fail('entity', value)
  }
  if (value === null && options.typeCastingStrategy === 'expectExactTypes') {
    return decoding.fail('entity', null)
  } else {
    return decoding.succeed((value ?? {}) as Record<string, unknown>)
  }
}

function decodeEntityProperties(
  fields: model.Types,
  entity: Record<string, unknown>,
  options: Required<decoding.Options>,
): decoding.Result<any> {
  const keySet = new Set([...Object.keys(fields), ...Object.keys(entity)])
  const errors: decoding.Error[] = []
  const result: Record<string, unknown> = {}
  for (const key of keySet) {
    if (errors.length > 0 && options.errorReportingStrategy === 'stopAtFirstError') {
      break
    }
    const type = fields[key]
    const value = entity[key]
    if (type === undefined && value === undefined) {
      continue
    } else if (!type && options.fieldStrictness === 'expectExactFields') {
      errors.push({ expected: 'undefined', got: value, path: path.ofField(key) })
      continue
    } else if (!type) {
      continue
    }
    const decodedValue = model.concretise(type).decodeWithoutValidation(value, options)
    if (decodedValue.isOk) {
      if (decodedValue.value !== undefined) {
        result[key] = decodedValue.value
      }
    } else {
      errors.push(...path.prependFieldToAll(decodedValue.error, key))
    }
  }
  if (errors.length > 0) {
    return decoding.failWithErrors(errors)
  } else {
    return decoding.succeed(result)
  }
}
