import { model } from '@mondrian-framework/model'
import { mapObject } from '@mondrian-framework/utils'

type ErrorsDefinition = { [K in string]: { message: string; details?: model.Type } }
/**
 * Generic error type with a standard structure.
 * { message: string, details: T }
 */
type Error<Es extends ErrorsDefinition> = {
  [K in keyof Es]: model.ObjectType<
    model.Mutability.Immutable,
    {
      message: model.LiteralType<Es[K]['message']>
      details: [Exclude<Es[K]['details'], undefined>] extends [infer T extends model.Type]
        ? T
        : model.LiteralType<undefined>
    }
  > &
    ([Exclude<Es[K]['details'], undefined>] extends [infer T extends model.Type]
      ? IsOmittable<T> extends true
        ? {
            error(details?: model.Infer<T>): {
              [K2 in K]: { readonly message: Es[K]['message']; readonly details: model.Infer<T> }
            }
          }
        : {
            error(details: model.Infer<T>): {
              [K2 in K]: { readonly message: Es[K]['message']; readonly details: model.Infer<T> }
            }
          }
      : {
          error(details?: undefined): { [K2 in K]: { readonly message: Es[K]['message']; readonly details: undefined } }
        })
}

/**
 * Defines an error type in a standard way.
 *
 * Example:
 * ```ts
 * import { error, functions } from '@mondrian-framework/module'
 * import { model } from '@mondrian-framework/model'
 *
 * const errors = error.define({
 *   unauthorized: { message: 'Unauthorised access.' },
 *   tooManyRequests: { message: 'Too many requests.', details: model.object({ count: model.number(), max: model.number() }) }
 * })
 *
 * const f = functions.define({
 *   input: model.string(),
 *   output: model.string(),
 *   errors,
 * }).implement({
 *   async body({ input }) {
 *     if (input === '???') {
 *       return result.fail(tooManyRequests.error({ count: 11, max: 10 }))
 *     }
 *     //...
 *     return result.fail(unauthorized.error())
 *   })
 * })
 * ```
 */
export function define<const Es extends ErrorsDefinition>(errors: Es): Error<Es> {
  return mapObject(errors, (errorCode, { message, details }) => {
    const detailsType = details ?? model.undefined()
    const defaultValue = model.matcher({
      nullable: () => null,
      literal: ({ literalValue }) => literalValue,
      otherwise: () => {
        throw new Error('Type system should have prevented this.')
      },
    })
    const nonOptional = !canBeOptional(detailsType)
    const obj: any = model.object({
      message: model.literal(message),
      details: detailsType,
    })
    obj.error = (details: unknown) => ({
      [errorCode]: {
        message,
        details: details === undefined && nonOptional ? defaultValue(detailsType) : details,
      },
    })
    return obj
  }) as unknown as Error<Es>
}

/**
 * Checks if a type is omittable.
 * It is omittable if it is optional, nullable, literal undefined, or literal null.
 */
//prettier-ignore
export type IsOmittable<T extends model.Type> 
  = [T] extends [model.NullableType<any>] ? true
  : [T] extends [model.OptionalType<any>] ? true
  : [T] extends [model.LiteralType<any>] ? true
  : [T] extends [model.NullableType<infer T1>] ? IsOmittable<T1>
  : [T] extends [(() => infer T1 extends model.Type)] ? IsOmittable<T1>
  : false

/**
 * Checks if a type contains undefined value.
 */
function canBeOptional(type: model.Type): boolean {
  return model.match(type, {
    optional: () => true,
    nullable: ({ wrappedType }) => canBeOptional(wrappedType),
    literal: ({ literalValue }) => literalValue === undefined,
    otherwise: () => false,
  })
}
