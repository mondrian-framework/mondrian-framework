import * as m from './exports'
export * from './exports'
export { m }
export default m

export * from './type-system'
export { decode, DecodeOptions, Result as DecodeResult } from './decoder'
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
