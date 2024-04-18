import { decoding, model, validation, encoding, utils } from '../..'
import { BaseType } from './base'
import { ObjectTypeImpl } from './object'
import { JSONType } from '@mondrian-framework/utils'
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
  private readonly obj: ObjectTypeImpl<M, Ts>

  protected getThis = () => this
  protected fromOptions = (options: model.EntityTypeOptions) =>
    new EntityTypeImpl(this.mutability, this.fields, options)

  immutable = () => entity(this.fields, this.options) as any
  mutable = () => mutableEntity(this.fields, this.options) as any

  constructor(mutability: M, fields: Ts, options?: model.EntityTypeOptions) {
    super(options)
    this.mutability = mutability
    this.fields = fields
    this.obj = new ObjectTypeImpl(mutability, fields, options)
  }

  protected encodeWithoutValidationInternal(
    value: model.Infer<model.EntityType<M, Ts>>,
    options: Required<encoding.Options>,
  ): JSONType {
    return this.obj.encodeWithoutValidationInternal(value, options)
  }

  protected validateInternal(
    value: model.Infer<model.EntityType<M, Ts>>,
    options: Required<validation.Options>,
  ): validation.Result {
    return this.obj.validateInternal(value, options)
  }

  protected decodeWithoutValidationInternal(
    value: unknown,
    options: Required<decoding.Options>,
  ): decoding.Result<model.Infer<model.EntityType<M, Ts>>> {
    return this.obj.decodeWithoutValidation(value, options)
  }

  arbitraryInternal(maxDepth: number): gen.Arbitrary<model.Infer<model.ObjectType<M, Ts>>> {
    return this.obj.arbitraryInternal(maxDepth)
  }
}
