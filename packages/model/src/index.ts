import * as m from './exports'

export { m }
export default m

export { decode, DecodingOptions, isType, assertType } from './decoder'
export { encode } from './encoder'
export { validateAndEncode } from './converter'
export { validate, ValidationOptions } from './validate'

export * as types from './exports'
export * as projection from './projection'
export * as result from './result'
