import * as m from './exports'
import * as Result from './result'

export * from './exports'
export { m }
export default m

export { Result }

export * from './type-system'
export { decode, DecodeOptions } from './decoder'
export { encode } from './encoder'
export { decodeAndValidate, validateAndEncode } from './converter'
export { validate, isType, assertType } from './validate'
export { lazyToType, isNullable, isVoidType, hasDecorator, getFirstConcreteType } from './utils'
export {
  getProjectionType,
  GenericProjection,
  subProjection,
  getProjectedType,
  getRequiredProjection,
  mergeProjections,
} from './projection'
