import { decoding, path, model, validation } from '../../'
import { DefaultMethods } from './base'
import { JSONType } from '@mondrian-framework/utils'
import gen from 'fast-check'

/**
 * @param wrappedType the {@link model.Type} describing the items held by the new `ArrayType`
 * @param options the {@link model.ArrayTypeOptions} used to define the new `ArrayType`
 * @returns a {@link model.ArrayType} holding items of the given type
 * @example ```ts
 *          type StringArray = model.Infer<typeof stringArray>
 *          const stringArray = model.array(string(), {
 *            name: "a list of at most 3 strings",
 *            maxItems: 3,
 *          })
 *
 *          const strings: StringArray = ["hello", " ", "world!"]
 *          ```
 */
export function array<T extends model.Type>(
  wrappedType: T,
  options?: model.ArrayTypeOptions,
): model.ArrayType<model.Mutability.Immutable, T> {
  return new ArrayTypeImpl(model.Mutability.Immutable, wrappedType, options)
}

/**
 * The same as the {@link array `array`} function, but the inferred array is `readonly`.
 *
 * @param wrappedType the {@link model.Type} describing the items held by the new `ArrayType`
 * @param options the {@link model.ArrayTypeOptions} used to define the new `ArrayType`
 * @returns a {@link model.ArrayType} holding items of the given type
 */
export function mutableArray<T extends model.Type>(
  wrappedType: T,
  options?: model.ArrayTypeOptions,
): model.ArrayType<model.Mutability.Mutable, T> {
  return new ArrayTypeImpl(model.Mutability.Mutable, wrappedType, options)
}

class ArrayTypeImpl<M extends model.Mutability, T extends model.Type>
  extends DefaultMethods<model.ArrayType<M, T>>
  implements model.ArrayType<M, T>
{
  readonly kind = model.Kind.Array
  readonly wrappedType: T
  readonly mutability: M

  getThis = () => this
  immutable = () => array(this.wrappedType, this.options)
  mutable = () => mutableArray(this.wrappedType, this.options)
  fromOptions = (options: model.ArrayTypeOptions) => new ArrayTypeImpl(this.mutability, this.wrappedType, options)

  constructor(mutability: M, wrappedType: T, options?: model.ArrayTypeOptions) {
    super(options)
    this.wrappedType = wrappedType
    this.mutability = mutability
  }

  encodeWithNoChecks(value: model.Infer<model.ArrayType<M, T>>): JSONType {
    const concreteItemType = model.concretise(this.wrappedType)
    return value.map((item) => concreteItemType.encodeWithoutValidation(item as never))
  }

  validate(value: model.Infer<model.ArrayType<M, T>>, validationOptions?: validation.Options): validation.Result {
    const { maxItems, minItems } = this.options ?? {}
    const { errorReportingStrategy } = { ...validation.defaultOptions, ...validationOptions }
    const errors: validation.Error[] = []
    if (this.options?.maxItems != null && value.length > this.options.maxItems) {
      const error: validation.Error = {
        assertion: `array must have at most ${maxItems} items`,
        got: value.length,
        path: path.root,
      }
      if (errorReportingStrategy === 'stopAtFirstError') {
        return validation.failWithErrors([error])
      } else {
        errors.push(error)
      }
    }
    if (this.options?.minItems != null && value.length < this.options.minItems) {
      const error: validation.Error = {
        assertion: `array must have at least ${minItems} items`,
        got: value.length,
        path: path.root,
      }
      if (errorReportingStrategy === 'stopAtFirstError') {
        return validation.failWithErrors([error])
      } else {
        errors.push(error)
      }
    }
    const result = this.validateArrayElements(value, { errorReportingStrategy })
    if (errors.length > 0) {
      const additionalErrors = result.match(
        () => [],
        (e) => e,
      )
      return validation.failWithErrors([...errors, ...additionalErrors])
    } else {
      return result
    }
  }

  private validateArrayElements(
    array: model.Infer<model.ArrayType<any, T>>,
    validationOptions: validation.Options,
  ): validation.Result {
    const concreteType = model.concretise(this.wrappedType)
    const errors: validation.Error[] = []
    for (let i = 0; i < array.length; i++) {
      if (errors.length > 0 && validationOptions.errorReportingStrategy === 'stopAtFirstError') {
        break
      }
      const result = concreteType.validate(array[i] as never, validationOptions)
      if (!result.isOk) {
        errors.push(...path.prependIndexToAll(result.error, i))
      }
    }
    if (errors.length > 0) {
      return validation.failWithErrors(errors)
    } else {
      return validation.succeed()
    }
  }

  decodeWithoutValidation(
    value: unknown,
    decodingOptions?: decoding.Options,
  ): decoding.Result<model.Infer<model.ArrayType<M, T>>> {
    if (value instanceof Array) {
      return this.decodeArrayValues(value, { ...decoding.defaultOptions, ...decodingOptions })
    } else if (decodingOptions?.typeCastingStrategy === 'tryCasting' && value instanceof Object) {
      return this.decodeObjectAsArray(value, decodingOptions)
    } else {
      return decoding.fail('array', value)
    }
  }

  private decodeArrayValues<T extends model.Type>(
    array: unknown[],
    decodingOptions: decoding.Options,
  ): decoding.Result<model.Infer<model.ArrayType<M, T>>> {
    const concreteType = model.concretise(this.wrappedType)
    const results: any[] = []
    const errors: decoding.Error[] = []
    for (let i = 0; i < array.length; i++) {
      if (errors.length > 0 && decodingOptions.errorReportingStrategy === 'stopAtFirstError') {
        break
      }
      const result = concreteType.decodeWithoutValidation(array[i] as never, decodingOptions)
      if (result.isOk) {
        results.push(result.value)
      } else {
        errors.push(...path.prependIndexToAll(result.error, i))
      }
    }
    if (errors.length > 0) {
      return decoding.failWithErrors(errors)
    } else {
      return decoding.succeed(results)
    }
  }

  private decodeObjectAsArray(
    object: Object,
    decodingOptions: decoding.Options,
  ): decoding.Result<model.Infer<model.ArrayType<M, T>>> {
    return objectToArray(object).chain((object) => this.decodeArrayValues(Object.values(object), decodingOptions))
  }

  arbitrary(maxDepth: number): gen.Arbitrary<model.Infer<model.ArrayType<M, T>>> {
    if (maxDepth <= 0 && (this.options?.minItems ?? 0) <= 0) {
      return gen.constant([])
    } else {
      const concreteType = model.concretise(this.wrappedType)
      return gen.array(concreteType.arbitrary(maxDepth), {
        minLength: this.options?.minItems,
        maxLength: this.options?.maxItems,
      })
    }
  }
}

/**
 * @param object an object to check for array-castability
 * @returns the values of the object sorted by their key, if the given object is castable as an array: that is, if all
 *          its keys are consecutive numbers from `0` up to a given `n`
 */
function objectToArray(object: Object): decoding.Result<any[]> {
  const keys = keysAsConsecutiveNumbers(object)
  return keys === undefined
    ? decoding.fail('array', object)
    : decoding.succeed(keys.map((i) => object[i as keyof object]))
}

/**
 * @param object the object whose keys will be converted to an array of sorted numbers
 * @returns an array of sorted numbers if all the keys of `object` are numbers (starting from 0) and consecutive, that
 *          is, the object is in the form `{0: "a", 1: "b", 2: "c", ...}`
 */
function keysAsConsecutiveNumbers(object: Object): number[] | undefined {
  const keys = Object.keys(object).map(Number).sort()
  if (keys.length === 0) {
    return []
  }
  const startsAtZero = keys.at(0) === 0
  return startsAtZero && allConsecutive(keys) ? keys : undefined
}

/**
 * @param numbers a _non empty_ array of numbers
 * @returns `true` if all numbers in the array are consecutive in ascending order, that is the array is in the form
 *          `[n, n+1, n+2, ...]`
 */
function allConsecutive(numbers: number[]): boolean {
  let [previousNumber, ...rest] = numbers
  for (const number of rest) {
    const isConsecutive = previousNumber + 1 === number
    if (!isConsecutive) {
      return false
    } else {
      previousNumber = number
    }
  }
  return true
}
