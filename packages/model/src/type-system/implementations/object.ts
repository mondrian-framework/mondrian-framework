import { decoding, path, result, types, validation } from '../../'
import { always, filterMapObject, mergeArrays, prependFieldToAll } from '../../utils'
import { DefaultMethods } from './base'
import { JSONType } from '@mondrian-framework/utils'

/**
 * @param types an object where each field is itself a {@link Type `Type`}, used to determine the structure of the
 *              new `ObjectType`
 * @param options the {@link ObjectTypeOptions options} used to define the new `ObjectType`
 * @returns an {@link ObjectType `ObjectType`} with the provided `values` and `options`
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

  encodeWithoutValidation(value: types.Infer<types.ObjectType<M, Ts>>): JSONType {
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
    const validateEntry = ([fieldName, fieldValue]: [string, unknown]) =>
      types
        .concretise(this.fields[fieldName])
        .validate(fieldValue as never, options)
        .mapError((errors) => prependFieldToAll(errors, fieldName))

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
  const addDecodedEntry = (accumulator: [string, unknown][], [fieldName, value]: readonly [string, unknown]) => {
    accumulator.push([fieldName, value])
    return accumulator
  }
  const decodeEntry = ([fieldName, fieldType]: [string, types.Type]) =>
    types
      .concretise(fieldType)
      .decodeWithoutValidation(object[fieldName], decodingOptions)
      .map((value) => [fieldName, value] as const)
      .mapError((errors) => prependFieldToAll(errors, fieldName))

  const entries = Object.entries(fields)
  const decodedEntries =
    decodingOptions?.errorReportingStrategy === 'allErrors'
      ? result.tryEach(entries, [], addDecodedEntry, [] as decoding.Error[], mergeArrays, decodeEntry)
      : result.tryEachFailFast(entries, [], addDecodedEntry, decodeEntry)
  return decodedEntries.map(Object.fromEntries)
}
