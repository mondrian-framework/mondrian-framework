import * as m from './exports'
export default m

export * from './type-system'
export { decode, DecodeOptions, DecodeResult } from './decoder'
export { encode } from './encoder'
export { is } from './is'
export { lazyToType, isNullable, isVoidType, hasDecorator } from './utils'
export { getProjectionType, GenericProjection } from './projection'
