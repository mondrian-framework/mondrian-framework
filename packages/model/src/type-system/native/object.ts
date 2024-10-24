import { decoding, path, model, validation, encoding, utils } from '../..'
import { assertSafeObjectFields } from '../../utils'
import { BaseType } from './base'
import { JSONType, filterMapObject } from '@mondrian-framework/utils'
import gen from 'fast-check'

/**
 * @param types an object where each field is itself a {@link model.Type}, used to determine the structure of the
 *              new `ObjectType`
 * @param options the {@link model.ObjectTypeOptions} used to define the new `ObjectType`
 * @returns an {@link model.ObjectType} with the provided values
 * @example Imagine you are modelling a `User` that has a username, an age and a boolean flag to tell if it is an admin
 *          or not. Its definition could look like this:
 *
 *          ```ts
 *          type User = Infer<typeof user>
 *          const user = object(
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
export function object<Ts extends utils.RichFields>(
  fields: Ts,
  options?: Omit<model.ObjectTypeOptions, 'fields'>,
): model.ObjectType<model.Mutability.Immutable, utils.RichFieldsToTypes<Ts>> {
  const { fields: fieldsOptions, types } = utils.richFieldsToTypes(fields)
  return new ObjectTypeImpl(
    model.Mutability.Immutable,
    types,
    fieldsOptions ? { ...options, fields: fieldsOptions } : options,
  )
}

export function mutableObject<Ts extends utils.RichFields>(
  fields: Ts,
  options?: Omit<model.ObjectTypeOptions, 'fields'>,
): model.ObjectType<model.Mutability.Mutable, utils.RichFieldsToTypes<Ts>> {
  const { fields: fieldsOptions, types } = utils.richFieldsToTypes(fields)
  return new ObjectTypeImpl(
    model.Mutability.Mutable,
    types,
    fieldsOptions ? { ...options, fields: fieldsOptions } : options,
  )
}

export class ObjectTypeImpl<M extends model.Mutability, Ts extends model.Types>
  extends BaseType<model.ObjectType<M, Ts>>
  implements model.ObjectType<M, Ts>
{
  readonly kind = model.Kind.Object
  readonly mutability: M
  readonly fields: Ts
  readonly concretizedFields: Record<string, model.ConcreteType>
  readonly fieldsSet: Set<string>

  protected getThis = () => this
  protected fromOptions = (options: model.ObjectTypeOptions) =>
    new ObjectTypeImpl(this.mutability, this.fields, options)

  immutable = () => object(this.fields, this.options) as any
  mutable = () => mutableObject(this.fields, this.options) as any

  constructor(mutability: M, fields: Ts, options?: model.ObjectTypeOptions) {
    super(options)
    assertSafeObjectFields(fields)
    this.mutability = mutability
    this.fields = fields
    this.fieldsSet = new Set(Object.keys(fields))
    this.concretizedFields = {}
  }

  public encodeWithoutValidationInternal(
    value: model.Infer<model.ObjectType<M, Ts>>,
    options: Required<encoding.Options>,
  ): JSONType {
    const object = value as Record<string, model.Type>
    return filterMapObject(this.fields, (fieldName, fieldType) => {
      const concreteFieldType = model.concretise(fieldType)
      const fieldIsOptional = model.isOptional(concreteFieldType) || model.isLiteral(concreteFieldType, undefined)
      const rawField = object[fieldName]
      return fieldIsOptional && rawField === undefined
        ? undefined
        : concreteFieldType.encodeWithoutValidation(rawField as never, options)
    })
  }

  public validateInternal(
    value: model.Infer<model.ObjectType<M, Ts>>,
    options: Required<validation.Options>,
  ): validation.Result {
    const errors: validation.Error[] = []
    for (const key of this.fieldsSet) {
      const fieldValue = (value as Record<string, any>)[key]
      let concreteFieldType = this.concretizedFields[key]
      if (!concreteFieldType) {
        concreteFieldType = model.concretise(this.fields[key])
        this.concretizedFields[key] = concreteFieldType
      }
      const result = concreteFieldType.validate(fieldValue as never, options)
      if (result.isFailure) {
        errors.push(...path.prependFieldToAll(result.error, key))
        if (options.errorReportingStrategy === 'stopAtFirstError') {
          return validation.failWithErrors(errors)
        }
      }
    }
    if (errors.length > 0) {
      return validation.failWithErrors(errors)
    } else {
      return validation.succeed()
    }
  }

  public decodeWithoutValidationInternal(
    value: unknown,
    options: Required<decoding.Options>,
  ): decoding.Result<model.Infer<model.ObjectType<M, Ts>>> {
    if (typeof value !== 'object' || Array.isArray(value)) {
      return decoding.fail('object', value)
    }
    if (value === null && options.typeCastingStrategy === 'expectExactTypes') {
      return decoding.fail('object', null)
    }
    const object = (value ?? {}) as Record<string, unknown>
    const expectExactFields = options.fieldStrictness === 'expectExactFields'
    const stopAtFirstError = options.errorReportingStrategy === 'stopAtFirstError'
    const errors: decoding.Error[] = []
    if (expectExactFields) {
      for (const key of Object.keys(object)) {
        const value = object[key]
        if (value !== undefined && !this.fieldsSet.has(key)) {
          errors.push({ expected: 'undefined', got: value, path: path.ofField(key) })
          if (stopAtFirstError) {
            return decoding.failWithErrors(errors)
          } else {
            continue
          }
        }
      }
    }

    const result: Record<string, unknown> = {}
    for (const key of this.fieldsSet) {
      let concreteFieldType = this.concretizedFields[key]
      if (!concreteFieldType) {
        concreteFieldType = model.concretise(this.fields[key])
        this.concretizedFields[key] = concreteFieldType
      }
      const value = object[key]
      const decodedValue = concreteFieldType.decodeWithoutValidation(value, options)
      if (decodedValue.isOk) {
        if (decodedValue.value !== undefined) {
          result[key] = decodedValue.value
        }
      } else {
        errors.push(...path.prependFieldToAll(decodedValue.error, key))
        if (stopAtFirstError) {
          return decoding.failWithErrors(errors)
        }
      }
    }

    if (errors.length > 0) {
      return decoding.failWithErrors(errors)
    } else {
      return decoding.succeed(result) as decoding.Result<any>
    }
  }

  public arbitraryInternal(maxDepth: number): gen.Arbitrary<model.Infer<model.ObjectType<M, Ts>>> {
    const entriesGenerators = Object.fromEntries(
      Object.entries(this.fields).map(
        ([fieldName, fieldType]: [string, model.Type]) =>
          [fieldName, model.concretise(fieldType).arbitrary(maxDepth - 1)] as const,
      ),
    )
    return gen.record(entriesGenerators) as gen.Arbitrary<model.Infer<model.ObjectType<M, Ts>>>
  }
}
