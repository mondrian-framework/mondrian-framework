import { decoding, result, types, validation } from '../../'
import { always, mergeArrays, prependIndexToAll } from '../../utils'
import { DefaultMethods } from './base'
import { JSONType } from '@mondrian-framework/utils'

/**
 * @param wrappedType the {@link types.Type} describing the items held by the new `ArrayType`
 * @param options the {@link types.ArrayTypeOptions} used to define the new `ArrayType`
 * @returns a {@link types.ArrayType} holding items of the given type
 * @example ```ts
 *          type StringArray = types.Infer<typeof stringArray>
 *          const stringArray = types.array(string(), {
 *            name: "a list of at most 3 strings",
 *            maxItems: 3,
 *          })
 *
 *          const strings: StringArray = ["hello", " ", "world!"]
 *          ```
 */
export function array<T extends types.Type>(
  wrappedType: T,
  options?: types.OptionsOf<types.ArrayType<types.Mutability.Immutable, T>>,
): types.ArrayType<types.Mutability.Immutable, T> {
  return new ArrayTypeImpl(types.Mutability.Immutable, wrappedType, options)
}

/**
 * The same as the {@link array `array`} function, but the inferred array is `readonly`.
 *
 * @param wrappedType the {@link types.Type} describing the items held by the new `ArrayType`
 * @param options the {@link types.ArrayTypeOptions} used to define the new `ArrayType`
 * @returns a {@link types.ArrayType} holding items of the given type
 */
export function mutableArray<T extends types.Type>(
  wrappedType: T,
  options?: types.OptionsOf<types.ArrayType<types.Mutability.Mutable, T>>,
): types.ArrayType<types.Mutability.Mutable, T> {
  return new ArrayTypeImpl(types.Mutability.Mutable, wrappedType, options)
}

class ArrayTypeImpl<M extends types.Mutability, T extends types.Type>
  extends DefaultMethods<types.ArrayType<M, T>>
  implements types.ArrayType<M, T>
{
  readonly kind = types.Kind.Array
  readonly wrappedType: T
  readonly mutability: M

  getThis = () => this
  immutable = () => array(this.wrappedType, this.options)
  mutable = () => mutableArray(this.wrappedType, this.options)
  fromOptions = (options: types.OptionsOf<types.ArrayType<M, T>>) =>
    new ArrayTypeImpl(this.mutability, this.wrappedType, options)

  constructor(mutability: M, wrappedType: T, options?: types.OptionsOf<types.ArrayType<M, T>>) {
    super(options)
    this.wrappedType = wrappedType
    this.mutability = mutability
  }

  encodeWithoutValidation(value: types.Infer<types.ArrayType<M, T>>): JSONType {
    const concreteItemType = types.concretise(this.wrappedType)
    return value.map((item) => concreteItemType.encodeWithoutValidation(item as never))
  }

  validate(value: types.Infer<types.ArrayType<M, T>>, validationOptions?: validation.Options): validation.Result {
    const { maxItems, minItems } = this.options ?? {}
    const maxLengthMessage = `array must have at most ${maxItems} items`
    const minLengthMessage = `array must have at least ${minItems} items`
    const maxLengthValidation =
      maxItems && value.length > maxItems ? validation.fail(maxLengthMessage, value) : validation.succeed()
    const minLengthValidation =
      minItems && value.length < minItems ? validation.fail(minLengthMessage, value) : validation.succeed()

    const options = { ...validation.defaultOptions, ...validationOptions }
    // prettier-ignore
    return and(options, maxLengthValidation, // First check the array respects the maximum length
      () => and(options, minLengthValidation, // Then check that is respects the minimum length
        () => this.validateArrayElements(value, options), // Lastly validate its items
      ),
    )
  }

  private validateArrayElements(
    array: types.Infer<types.ArrayType<any, T>>,
    options: validation.Options,
  ): validation.Result {
    const validateItem = (item: types.Infer<T>, index: number) =>
      types
        .concretise(this.wrappedType)
        .validate(item as never, options)
        .mapError((errors) => prependIndexToAll(errors, index))

    return options.errorReportingStrategy === 'stopAtFirstError'
      ? result.tryEachFailFast(array, true, always(true), validateItem)
      : result.tryEach(array, true, always(true), [] as validation.Error[], mergeArrays, validateItem)
  }

  decodeWithoutValidation(
    value: unknown,
    decodingOptions?: decoding.Options,
  ): decoding.Result<types.Infer<types.ArrayType<M, T>>> {
    if (value instanceof Array) {
      return this.decodeArrayValues(value, decodingOptions)
    } else if (decodingOptions?.typeCastingStrategy === 'tryCasting' && value instanceof Object) {
      return this.decodeObjectAsArray(value, decodingOptions)
    } else {
      return decoding.fail('array', value)
    }
  }

  private decodeArrayValues<T extends types.Type>(
    array: unknown[],
    decodingOptions?: decoding.Options,
  ): decoding.Result<types.Infer<types.ArrayType<M, T>>> {
    const addDecodedItem = (accumulator: any[], item: any) => {
      // Here to be more efficient we update the accumulator in place and return a reference to it,
      // otherwise, we would need to create a new accumulator for each new decoded item
      accumulator.push(item)
      return accumulator
    }
    const decodeItem = (item: unknown, index: number) =>
      types
        .concretise(this.wrappedType)
        .decodeWithoutValidation(item, decodingOptions)
        .mapError((errors) => prependIndexToAll(errors, index))

    return decodingOptions?.errorReportingStrategy === 'allErrors'
      ? result.tryEach(array, [] as unknown[], addDecodedItem, [] as decoding.Error[], mergeArrays, decodeItem)
      : result.tryEachFailFast(array, [] as unknown[], addDecodedItem, decodeItem)
  }

  private decodeObjectAsArray(
    object: Object,
    decodingOptions: decoding.Options,
  ): decoding.Result<types.Infer<types.ArrayType<M, T>>> {
    return objectToArray(object).chain((object) => this.decodeArrayValues(Object.values(object), decodingOptions))
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

/**
 * @param options the validation options to be used when concatenating multiple steps
 * @param result the first result of the validation
 * @param other a function to lazily generate the next validation step
 * @returns a `Result` based on the options and the first `result`: if the validation
 *          strategy is to fail at the first error then as soon as an error is encountered
 *          the validation stops and fails with that error (so the second validation step
 *          may never be executed).
 *
 *          If the first step succeeds, the result will be the one obatined by the second
 *          step of the validation process
 */
function and(
  options: validation.Options,
  result: validation.Result,
  other: () => validation.Result,
): validation.Result {
  if (!result.isOk) {
    if (options?.errorReportingStrategy === 'stopAtFirstError') {
      return result
    } else {
      const otherErrors = other().match(
        () => [],
        (errors) => errors,
      )
      return validation.failWithErrors([...result.error, ...otherErrors])
    }
  } else {
    return other()
  }
}
