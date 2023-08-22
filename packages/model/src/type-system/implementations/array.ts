import { path, result, types, validation } from '../../'
import { always, mergeArrays } from '../../utils'
import { DefaultMethods } from './base'
import { JSONType } from '@mondrian-framework/utils'

/**
 * @param wrappedType the {@link types.Type `Type`} describing the items held by the new `ArrayType`
 * @param options the {@link types.ArrayTypeOptions options} used to define the new `ArrayType`
 * @returns an {@link types.ArrayType `ArrayType`} holding items of the given type, with the given `options`
 * @example ```ts
 *          type StringArray = Infer<typeof stringArray>
 *          const stringArray = array(string(), {
 *            name: "a list of at most 3 strings",
 *            maxItems: 3,
 *          })
 *
 *          const strings: StringArray = ["hello", " ", "world!"]
 *          ```
 */
export function array<T extends types.Type>(
  wrappedType: T,
  options?: types.OptionsOf<types.ArrayType<'immutable', T>>,
): types.ArrayType<'immutable', T> {
  return new ArrayTypeImpl('immutable', wrappedType, options)
}

/**
 * The same as the {@link array `array`} function, but the inferred array is `readonly`.
 *
 * @param wrappedType the {@link types.Type `Type`} describing the items held by the new `ArrayType`
 * @param options the {@link types.ArrayTypeOptions options} used to define the new `ArrayType`
 * @returns an {@link types.ArrayType `ArrayType`} holding items of the given type, with the given `options`
 */
export function mutableArray<T extends types.Type>(
  wrappedType: T,
  options?: types.OptionsOf<types.ArrayType<'mutable', T>>,
): types.ArrayType<'mutable', T> {
  return new ArrayTypeImpl('mutable', wrappedType, options)
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
    return and(options, maxLengthValidation,
    () => and(options, minLengthValidation,
      () => this.validateArrayElements(value, options),
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
        .mapError((errors) => path.prependIndexToAll(errors, index))
    return options.errorReportingStrategy === 'stopAtFirstError'
      ? result.tryEachFailFast(array, true, always(true), validateItem)
      : result.tryEach(array, true, always(true), [] as validation.Error[], mergeArrays, validateItem)
  }
}

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
