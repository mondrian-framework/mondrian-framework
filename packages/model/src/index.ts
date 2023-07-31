import * as m from './exports'

export * from './exports'
export { m }
export default m

export * from './type-system'
export { decode, DecodingOptions, isType, assertType } from './decoder'
export { encode } from './encoder'
export { validateAndEncode } from './converter'
export { validate, ValidationOptions } from './validate'
export {
  //getProjectionType,
  //GenericProjection,
  subProjection,
  //getProjectedType,
  //getRequiredProjection,
  //mergeProjections,
  //projectionDepth,
} from './projection'

export { Error, Failure, Result, Success, error, success } from './result'
