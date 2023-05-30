import { success } from '../result'
import { CustomTypeOpts, custom, literal } from '../type-system'

//TODO: make it root
export function voidType(opts?: CustomTypeOpts) {
  return custom(
    {
      name: 'void',
      encodedType: literal(null).optional(),
      decode: () => {
        return success<void>(undefined)
      },
      encode: () => {
        return undefined
      },
      validate() {
        return success<void>(undefined)
      },
    },
    opts,
  )
}
