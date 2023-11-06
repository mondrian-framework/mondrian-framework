import { decoding, path, result, types, validation } from '../../'
import { prependFieldToAll } from '../../utils'
import { DefaultMethods } from './base'
import { JSONType, always, filterMapObject, mergeArrays } from '@mondrian-framework/utils'
import gen from 'fast-check'

/**
 * @param types an object where each field is itself a {@link types.Type}, used to determine the structure of the
 *              new `ObjectType`
 * @param options the {@link types.ObjectTypeOptions} used to define the new `ObjectType`
 * @returns an {@link types.ObjectType} with the provided values
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
export function object<Ts extends types.Types>(
  fields: Ts,
  options?: types.OptionsOf<types.ObjectType<types.Mutability.Immutable, Ts>>,
): types.ObjectType<types.Mutability.Immutable, Ts> {
  return new ObjectTypeImpl(types.Mutability.Immutable, fields, options)
}

export function mutableObject<Ts extends types.Types>(
  fields: Ts,
  options?: types.OptionsOf<types.ObjectType<types.Mutability.Mutable, Ts>>,
): types.ObjectType<types.Mutability.Mutable, Ts> {
  return new ObjectTypeImpl(types.Mutability.Mutable, fields, options)
}

class ObjectTypeImpl<M extends types.Mutability, Ts extends types.Types>
  extends DefaultMethods<types.ObjectType<M, Ts>>
  implements types.ObjectType<M, Ts>
{
  readonly kind = types.Kind.Object
  readonly mutability: M
  readonly fields: Ts

  getThis = () => this
  fromOptions = (options: types.OptionsOf<types.ObjectType<M, Ts>>) =>
    new ObjectTypeImpl(this.mutability, this.fields, options)

  immutable = () => object(this.fields, this.options)
  mutable = () => mutableObject(this.fields, this.options)

  constructor(mutability: M, fields: Ts, options?: types.OptionsOf<types.ObjectType<M, Ts>>) {
    super(options)
    this.mutability = mutability
    this.fields = fields
  }

  encodeWithNoChecks(value: types.Infer<types.ObjectType<M, Ts>>): JSONType {
    const object = value as Record<string, types.Type>
    return filterMapObject(this.fields, (fieldName, fieldType) => {
      const concreteFieldType = types.concretise(fieldType)
      const fieldIsOptional = types.isOptional(concreteFieldType)
      const rawField = object[fieldName]
      const encodedField = concreteFieldType.encodeWithoutValidation(rawField as never)
      return fieldIsOptional && encodedField === null ? undefined : encodedField
    })
  }

  validate(value: types.Infer<types.ObjectType<M, Ts>>, validationOptions?: validation.Options): validation.Result {
    const options = { ...validation.defaultOptions, ...validationOptions }
    const entries = Object.entries(value)
    const validateEntry = ([fieldName, fieldValue]: [string, unknown]) => {
      const fieldExistsInModel = fieldName in this.fields
      return !fieldExistsInModel
        ? validation.succeed()
        : types
            .concretise(this.fields[fieldName])
            .validate(fieldValue as never, options)
            .mapError((errors) => prependFieldToAll(errors, fieldName))
    }

    return options.errorReportingStrategy === 'stopAtFirstError'
      ? result.tryEachFailFast(entries, true, always(true), validateEntry)
      : result.tryEach(entries, true, always(true), [] as validation.Error[], mergeArrays, validateEntry)
  }

  decodeWithoutValidation(
    value: unknown,
    decodingOptions?: decoding.Options,
  ): decoding.Result<types.Infer<types.ObjectType<M, Ts>>> {
    return castToObject(value, decodingOptions).chain((object) =>
      decodeObjectProperties(this.fields, object, decodingOptions),
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
  fields: types.Types,
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
