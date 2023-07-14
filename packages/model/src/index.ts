import * as m from './exports'
import * as Result from './result'

export * from './exports'
export { m }
export default m

export { Result }

export * from './type-system'
export { decode, DecodingOptions, isType, assertType } from './decoder'
export { encode } from './encoder'
export { validateAndEncode } from './converter'
export { validate } from './validate'
export {
  //getProjectionType,
  //GenericProjection,
  subProjection,
  getProjectedType,
  getRequiredProjection,
  mergeProjections,
  projectionDepth,
} from './projection'
