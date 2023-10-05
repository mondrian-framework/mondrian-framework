import { types, decoding, validation } from '../index'
import { prependFieldToAll } from '../utils'
import { JSONType, mapObject } from '@mondrian-framework/utils'

/**
 * The type of a record, defined as a custom type.
 */
export type RecordType<T extends types.Type> = types.CustomType<'record', RecordOptions, Record<string, types.Infer<T>>>

/**
 * Additional options for the Record CustomType
 */
export type RecordOptions = { fieldsType: types.Type }

/**
 * @param options the options used to create the new record custom type
 * @returns a {@link CustomType `CustomType`} representing a record
 */
export function record<const T extends types.Type>(fieldsType: T, options?: types.BaseOptions): RecordType<T> {
  return types.custom(
    'record',
    (value) => encodeRecord(fieldsType, value),
    (value, decodingOptions, options) => decodeRecord(fieldsType, value, decodingOptions, options),
    (value, validationOptions, options) => validateRecord(fieldsType, value, validationOptions, options),
    { ...options, fieldsType },
  )
}

function encodeRecord<T extends types.Type>(fieldsType: T, value: Record<string, types.Infer<T>>): JSONType {
  const concreteFieldsType = types.concretise(fieldsType)
  return mapObject(value, (_, fieldValue) => concreteFieldsType.encodeWithoutValidation(fieldValue as never))
}

function decodeRecord<T extends types.Type>(
  fieldsType: T,
  value: unknown,
  decodingOptions?: decoding.Options,
  _options?: RecordOptions,
): decoding.Result<Record<string, types.Infer<T>>> {
  if (typeof value !== 'object' || value === null) {
    return decoding.fail('object', value)
  }
  const concreteFieldsType = types.concretise(fieldsType)
  const entries: [string, any][] = []
  const errors: decoding.Error[] = []
  for (const [key, v] of Object.entries(value)) {
    const result = concreteFieldsType.decodeWithoutValidation(v, decodingOptions)
    if (result.isOk) {
      entries.push([key, result.value])
    } else {
      if (decodingOptions?.errorReportingStrategy === 'allErrors') {
        errors.push(...prependFieldToAll(result.error, key))
      } else {
        return result.mapError((error) => prependFieldToAll(error, key))
      }
    }
  }
  if (errors.length > 0) {
    return decoding.failWithErrors(errors)
  } else {
    return decoding.succeed(Object.fromEntries(entries))
  }
}

function validateRecord<T extends types.Type>(
  fieldsType: T,
  value: Record<string, types.Infer<T>>,
  validationOptions?: validation.Options,
  options?: RecordOptions,
): validation.Result {
  const concreteFieldsType = types.concretise(fieldsType)
  const errors: validation.Error[] = []
  for (const [key, v] of Object.entries(value)) {
    const result = concreteFieldsType.validate(v as never, validationOptions)
    if (!result.isOk) {
      if (validationOptions?.errorReportingStrategy === 'allErrors') {
        errors.push(...prependFieldToAll(result.error, key))
      } else {
        return result.mapError((error) => prependFieldToAll(error, key))
      }
    }
  }
  if (errors.length > 0) {
    return validation.failWithErrors(errors)
  } else {
    return validation.succeed()
  }
}
