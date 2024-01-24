import { model } from '@mondrian-framework/model'
import { capitalise, mapObject } from '@mondrian-framework/utils'

type ErrorsDefinition = { [K in string]: { message: string; details?: model.Type } }
/**
 * Generic error type with a standard structure.
 * { message: string, details: T }
 */
type Error<Es extends ErrorsDefinition> = {
  [K in keyof Es]: model.ObjectType<
    model.Mutability.Immutable,
    [Exclude<Es[K]['details'], undefined>] extends [infer T extends model.Type]
      ? {
          details: T
        }
      : {}
  >
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
 *       return result.fail({ tooManyRequests: { details: { count: 10, max: 5 } } })
 *     }
 *     //...
 *     return result.fail({ unauthorized: {} })
 *   })
 * })
 * ```
 */
export function define<const Es extends ErrorsDefinition>(
  errors: Es,
  options?: { capitalizeErrorNames?: boolean },
): Error<Es> {
  return mapObject(errors, (errorCode, { message, details }) => {
    const type = model.object(
      {
        message: model.literal(message, { allowUndefinedValue: true }),
        ...(details ? { details } : {}),
      },
      { name: options?.capitalizeErrorNames ? capitalise(`${errorCode}Error`) : `${errorCode}Error` },
    )
    return type as any
  }) as Error<Es>
}
