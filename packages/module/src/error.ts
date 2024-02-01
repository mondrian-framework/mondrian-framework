import { model } from '@mondrian-framework/model'
import { capitalise, mapObject } from '@mondrian-framework/utils'

type ErrorsDefinition = { [K in string]: { [F in string]: model.Type | string } }
/**
 * Generic error type with a standard structure.
 * { message: string, details: T }
 */
type Error<Es extends ErrorsDefinition> = {
  [K in keyof Es]: model.ObjectType<
    model.Mutability.Immutable,
    Pick<Es[K], NonStringKeys<Es[K]>> extends infer Ts extends model.Types ? Ts : {}
  >
}

type NonStringKeys<T extends { [K in string]: model.Type | string }> = {
  [K in keyof T]: T[K] extends string ? never : K
}[keyof T]

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
  return mapObject(errors, (errorCode, fields) => {
    const type = model.object(
      mapObject(fields, (_, field) =>
        typeof field === 'string' ? model.literal(field, { allowUndefinedValue: true }) : field,
      ),
      { name: options?.capitalizeErrorNames ? capitalise(`${errorCode}Error`) : `${errorCode}Error` },
    )
    return type as any
  }) as Error<Es>
}
