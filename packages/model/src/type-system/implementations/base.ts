import { result, types, validation } from '../../'
import { JSONType } from '@mondrian-framework/utils'

export abstract class DefaultMethods<T extends types.Type> {
  readonly options?: types.OptionsOf<T>

  constructor(options: types.OptionsOf<T> | undefined) {
    this.options = options
  }

  abstract getThis(): T
  abstract fromOptions(options?: types.OptionsOf<T>): T
  abstract encodeWithoutValidation(value: types.Infer<T>): JSONType

  encode(value: types.Infer<T>, validationOptions?: validation.Options): result.Result<JSONType, validation.Error[]> {
    // TODO: once we move validator to the interface change this as well
    return types
      .concretise(this.getThis())
      .validate(value as never, validationOptions)
      .replace(this.encodeWithoutValidation(value))
  }

  optional = () => types.optional(this.getThis())
  nullable = () => types.nullable(this.getThis())
  reference = () => types.reference(this.getThis())
  array = () => types.array(this.getThis())

  setOptions = (options: types.OptionsOf<T>) => this.fromOptions(options)
  updateOptions = (options: types.OptionsOf<T>) => this.fromOptions({ ...this.options, ...options })
  setName = (name: string) => this.fromOptions({ ...(this.options as types.OptionsOf<T>), name })
}
