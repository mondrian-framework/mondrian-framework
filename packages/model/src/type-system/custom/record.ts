import { model, decoding, validation, path, encoding } from '../../index'
import { forbiddenObjectFields } from '../../utils'
import { JSONType, mapObject } from '@mondrian-framework/utils'
import gen from 'fast-check'

/**
 * The type of a record, defined as a custom type.
 */
export type RecordType<T extends model.Type> = model.CustomType<'record', RecordOptions, Record<string, model.Infer<T>>>

/**
 * Additional options for the Record CustomType
 */
export type RecordOptions = { fieldsType: model.Type }

/**
 * @param options the options used to create the new record custom type
 * @returns a {@link CustomType `CustomType`} representing a record
 */
export function record<const T extends model.Type>(fieldsType: T, options?: model.BaseOptions): RecordType<T> {
  return model.custom(
    'record',
    (value, encodingOptions) => encodeRecord(fieldsType, value, encodingOptions),
    (value, decodingOptions) => decodeRecord(fieldsType, value, decodingOptions),
    (value, validationOptions) => validateRecord(fieldsType, value, validationOptions),
    (maxDepth) => recordArbitrary(fieldsType, maxDepth),
    { ...options, fieldsType },
  )
}

function encodeRecord<T extends model.Type>(
  fieldsType: T,
  value: Record<string, model.Infer<T>>,
  encodingOptions: Required<encoding.Options>,
): JSONType {
  const concreteFieldsType = model.concretise(fieldsType)
  return mapObject(value, (_, fieldValue) =>
    concreteFieldsType.encodeWithoutValidation(fieldValue as never, encodingOptions),
  )
}

function decodeRecord<T extends model.Type>(
  fieldsType: T,
  value: unknown,
  decodingOptions: Required<decoding.Options>,
): decoding.Result<Record<string, model.Infer<T>>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return decoding.fail('object', value)
  }
  const concreteFieldsType = model.concretise(fieldsType)
  const entries: [string, any][] = []
  const errors: decoding.Error[] = []
  for (const [key, v] of Object.entries(value)) {
    const result = concreteFieldsType.decodeWithoutValidation(v, decodingOptions)
    if (result.isOk) {
      entries.push([key, result.value])
    } else {
      if (decodingOptions.errorReportingStrategy === 'allErrors') {
        errors.push(...path.prependFieldToAll(result.error, key))
      } else {
        return result.mapError((error) => path.prependFieldToAll(error, key))
      }
    }
  }
  if (errors.length > 0) {
    return decoding.failWithErrors(errors)
  } else {
    return decoding.succeed(Object.fromEntries(entries))
  }
}

function validateRecord<T extends model.Type>(
  fieldsType: T,
  value: Record<string, model.Infer<T>>,
  validationOptions: Required<validation.Options>,
): validation.Result {
  const concreteFieldsType = model.concretise(fieldsType)
  const errors: validation.Error[] = []
  for (const [key, v] of Object.entries(value)) {
    const result = concreteFieldsType.validate(v as never, validationOptions)
    if (result.isFailure) {
      if (validationOptions.errorReportingStrategy === 'allErrors') {
        errors.push(...path.prependFieldToAll(result.error, key))
      } else {
        return result.mapError((error) => path.prependFieldToAll(error, key))
      }
    }
  }
  if (errors.length > 0) {
    return validation.failWithErrors(errors)
  } else {
    return validation.succeed()
  }
}

function recordArbitrary<T extends model.Type>(
  fieldsType: T,
  maxDepth: number,
): gen.Arbitrary<Record<string, model.Infer<T>>> {
  if (maxDepth <= 0) {
    return gen.constant({})
  } else {
    const concreteType = model.concretise(fieldsType)
    return gen
      .array(
        gen.tuple(
          gen.string().filter((s) => !forbiddenObjectFields.includes(s)),
          concreteType.arbitrary(maxDepth - 1),
        ),
      )
      .map(Object.fromEntries)
  }
}
