import { result, encoder, types, validator } from './index'
import { OptionalFields } from './utils'
import { JSONType } from '@mondrian-framework/utils'

export function validateAndEncode<const T extends types.Type>(
  type: T,
  value: types.Infer<T>,
  validationOptions?: OptionalFields<validator.ValidationOptions>,
): result.Result<JSONType> {
  const validationResult = validator.validate(type, value, validationOptions)
  return validationResult.success ? result.success(encoder.encode(type, value)) : validationResult
}
