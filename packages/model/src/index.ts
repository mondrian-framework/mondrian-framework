import * as m from './exports'
export * from './exports'
export { m }
export default m

export * from './type-system'
export { decode, DecodeOptions, DecodeResult } from './decoder'
export { encode } from './encoder'
export { is } from './is'
export { lazyToType, isNullable, isVoidType, hasDecorator, getFirstConcreteType } from './utils'
export {
  getProjectionType,
  GenericProjection,
  subProjection,
  getProjectedType,
  getRequiredProjection,
  mergeProjections,
} from './projection'
