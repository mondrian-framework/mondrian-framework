import { decoding, result, types, validation } from '../../'
import { JSONType } from '@mondrian-framework/utils'

export abstract class DefaultMethods<T extends types.Type> {
  readonly options?: types.OptionsOf<T>

  constructor(options: types.OptionsOf<T> | undefined) {
    this.options = options
  }

  abstract getThis(): T
  abstract fromOptions(options?: types.OptionsOf<T>): T
  abstract encodeWithoutValidation(value: types.Infer<T>): JSONType
  abstract decodeWithoutValidation(value: unknown, decodingOptions?: decoding.Options): decoding.Result<types.Infer<T>>
  abstract validate(value: types.Infer<T>, validationOptions?: validation.Options): validation.Result

  encode(value: types.Infer<T>, validationOptions?: validation.Options): result.Result<JSONType, validation.Error[]> {
    return types
      .concretise(this.getThis())
      .validate(value as never, validationOptions)
      .replace(this.encodeWithoutValidation(value))
  }

  decode(
    value: unknown,
    decodingOptions?: decoding.Options,
    validationOptions?: validation.Options,
  ): result.Result<types.Infer<T>, validation.Error[] | decoding.Error[]> {
    return this.decodeWithoutValidation(value, decodingOptions)
      .mapError((errors) => errors as validation.Error[] | decoding.Error[])
      .chain((decodedValue) => this.validate(decodedValue, validationOptions).replace(decodedValue))
  }

  optional = () => types.optional(this.getThis())
  nullable = () => types.nullable(this.getThis())
  reference = () => types.reference(this.getThis())
  array = () => types.array(this.getThis())

  setOptions = (options: types.OptionsOf<T>) => this.fromOptions(options)
  updateOptions = (options: types.OptionsOf<T>) => this.fromOptions({ ...this.options, ...options })
  setName = (name: string) => this.fromOptions({ ...(this.options as types.OptionsOf<T>), name })
}
