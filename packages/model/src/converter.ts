import { encode } from './encoder'
import { Result, success } from './result'
import { Infer, Type } from './type-system'
import { OptionalFields } from './utils'
import { ValidationOptions, validate } from './validate'
import { JSONType } from '@mondrian-framework/utils'

export function validateAndEncode<const T extends Type>(
  type: T,
  value: Infer<T>,
  validationOptions?: OptionalFields<ValidationOptions>,
): Result<JSONType> {
  const validationResult = validate(type, value, validationOptions)
  return validationResult.success ? success(encode(type, validationResult.value)) : validationResult
}
