import { types } from '../../'
import { DefaultMethods } from './base'
import { JSONType } from '@mondrian-framework/utils'
import { filterMapObject } from 'src/utils'

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
  options?: types.OptionsOf<types.ObjectType<'immutable', Ts>>,
): types.ObjectType<'immutable', Ts> {
  return new ObjectTypeImpl('immutable', fields, options)
}

export function mutableObject<Ts extends types.Types>(
  fields: Ts,
  options?: types.OptionsOf<types.ObjectType<'mutable', Ts>>,
): types.ObjectType<'mutable', Ts> {
  return new ObjectTypeImpl('mutable', fields, options)
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
}
