import { decoding, path, model, validation } from '../../'
import { prependFieldToAll } from '../../utils'
import { DefaultMethods } from './base'
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
 *            username: 'Giacomo',
 *            age: 24,
 *            isAdmin: false,
 *          }
 *          ```
 */
export function object<Ts extends model.Types>(
  fields: Ts,
  options?: model.ObjectTypeOptions,
): model.ObjectType<model.Mutability.Immutable, Ts> {
  return new ObjectTypeImpl(model.Mutability.Immutable, fields, options)
}

export function mutableObject<Ts extends model.Types>(
  fields: Ts,
  options?: model.ObjectTypeOptions,
): model.ObjectType<model.Mutability.Mutable, Ts> {
  return new ObjectTypeImpl(model.Mutability.Mutable, fields, options)
}

class ObjectTypeImpl<M extends model.Mutability, Ts extends model.Types>
  extends DefaultMethods<model.ObjectType<M, Ts>>
  implements model.ObjectType<M, Ts>
{
  readonly kind = model.Kind.Object
  readonly mutability: M
  readonly fields: Ts

  getThis = () => this
  fromOptions = (options: model.ObjectTypeOptions) => new ObjectTypeImpl(this.mutability, this.fields, options)

  immutable = () => object(this.fields, this.options)
  mutable = () => mutableObject(this.fields, this.options)

  constructor(mutability: M, fields: Ts, options?: model.ObjectTypeOptions) {
    super(options)
    this.mutability = mutability
    this.fields = fields
  }

  encodeWithNoChecks(value: model.Infer<model.ObjectType<M, Ts>>): JSONType {
    const object = value as Record<string, model.Type>
    return filterMapObject(this.fields, (fieldName, fieldType) => {
      const concreteFieldType = model.concretise(fieldType)
      const fieldIsOptional = model.isOptional(concreteFieldType)
      const rawField = object[fieldName]
      return fieldIsOptional && rawField === undefined
        ? undefined
        : concreteFieldType.encodeWithoutValidation(rawField as never)
    })
  }

  validate(value: model.Infer<model.ObjectType<M, Ts>>, validationOptions?: validation.Options): validation.Result {
    const options = { ...validation.defaultOptions, ...validationOptions }
    const entries = Object.entries(value)
    const errors: validation.Error[] = []
    for (const [fieldName, fieldValue] of entries) {
      if (errors.length > 0 && options.errorReportingStrategy === 'stopAtFirstError') {
        break
      }
      const concreteFieldType = model.concretise(this.fields[fieldName])
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
  ): decoding.Result<model.Infer<model.ObjectType<M, Ts>>> {
    return castToObject(value, decodingOptions).chain((object) =>
      decodeObjectProperties(this.fields, object, decodingOptions),
    )
  }

  arbitrary(maxDepth: number): gen.Arbitrary<model.Infer<model.ObjectType<M, Ts>>> {
    const entriesGenerators = Object.fromEntries(
      Object.entries(this.fields).map(
        ([fieldName, fieldType]: [string, model.Type]) =>
          [fieldName, model.concretise(fieldType).arbitrary(maxDepth - 1)] as const,
      ),
    )
    return gen.record(entriesGenerators) as gen.Arbitrary<model.Infer<model.ObjectType<M, Ts>>>
  }
}

function castToObject(value: unknown, decodingOptions?: decoding.Options): decoding.Result<Record<string, unknown>> {
  if (typeof value === 'object') {
    if (value === null && decodingOptions?.typeCastingStrategy !== 'tryCasting') {
      return decoding.fail('object', null)
    }
    return decoding.succeed((value ?? {}) as Record<string, unknown>)
  } else {
    return decoding.fail('object', value)
  }
}

function decodeObjectProperties(
  fields: model.Types,
  object: Record<string, unknown>,
  decodingOptions?: decoding.Options,
): decoding.Result<any> {
  const keySet = new Set([...Object.keys(fields), ...Object.keys(object)])
  const errors: decoding.Error[] = []
  const result: Record<string, unknown> = {}
  for (const key of keySet) {
    if (errors.length > 0 && decodingOptions?.errorReportingStrategy !== 'allErrors') {
      break
    }
    const type = fields[key]
    const value = object[key]
    if (type === undefined && value === undefined) {
      continue
    } else if (!type && decodingOptions?.fieldStrictness !== 'allowAdditionalFields') {
      errors.push({ expected: 'undefined', got: value, path: path.empty().prependField(key) })
      continue
    } else if (!type) {
      continue
    }
    const decodedValue = model.concretise(type).decodeWithoutValidation(value, decodingOptions)
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
