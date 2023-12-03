import { decoding, encoding, result, model, validation } from '../..'
import { JSONType } from '@mondrian-framework/utils'
import gen from 'fast-check'
import prand from 'pure-rand'

export abstract class DefaultMethods<T extends model.Type> {
  readonly options?: model.OptionsOf<T>

  constructor(options: model.OptionsOf<T> | undefined) {
    this.options = options
  }

  abstract getThis(): T
  abstract fromOptions(options?: model.OptionsOf<T>): T
  abstract encodeWithNoChecks(value: model.Infer<T>, options: Required<encoding.Options>): JSONType
  abstract decodeWithoutValidation(value: unknown, decodingOptions?: decoding.Options): decoding.Result<model.Infer<T>>
  abstract validate(value: model.Infer<T>, validationOptions?: validation.Options): validation.Result
  abstract arbitrary(maxDepth: number): gen.Arbitrary<model.Infer<T>>

  encodeWithoutValidation(value: model.Infer<T>, options?: encoding.Options): JSONType {
    const encodingOptions = { ...encoding.defaultOptions, ...options }
    if (encodingOptions.sensitiveInformationStrategy === 'hide' && this.options?.sensitive === true) {
      return null
    } else {
      return this.encodeWithNoChecks(value, encodingOptions)
    }
  }

  encode(
    value: model.Infer<T>,
    encodignOptions?: encoding.Options,
    validationOptions?: validation.Options,
  ): result.Result<JSONType, validation.Error[]> {
    return model
      .concretise(this.getThis())
      .validate(value as never, validationOptions)
      .replace(this.encodeWithoutValidation(value, encodignOptions))
  }

  decode(
    value: unknown,
    decodingOptions?: decoding.Options,
    validationOptions?: validation.Options,
  ): result.Result<model.Infer<T>, validation.Error[] | decoding.Error[]> {
    return this.decodeWithoutValidation(value, decodingOptions)
      .mapError((errors) => errors as validation.Error[] | decoding.Error[])
      .chain((decodedValue) => this.validate(decodedValue, validationOptions).replace(decodedValue))
  }

  example(args?: { maxDepth?: number; seed?: number }): model.Infer<T> {
    const randomSeed = args?.seed ?? Date.now() ^ (Math.random() * 0x100000000)
    const random = new gen.Random(prand.xoroshiro128plus(randomSeed))
    const value = this.arbitrary(args?.maxDepth ?? 1).generate(random, undefined)
    return value.value
  }

  optional = (options: model.OptionalTypeOptions) => model.optional(this.getThis(), options)
  nullable = (options: model.NullableTypeOptions) => model.nullable(this.getThis(), options)
  array = (options: model.ArrayTypeOptions) => model.array(this.getThis(), options)
  equals = (other: model.Type) => model.areEqual(this.getThis(), other)

  setOptions = (options: model.OptionsOf<T>) => this.fromOptions(options)
  updateOptions = (options: model.OptionsOf<T>) => this.fromOptions({ ...this.options, ...options })
  setName = (name: string) => this.fromOptions({ ...(this.options as model.OptionsOf<T>), name })
  sensitive = () => this.fromOptions({ ...(this.options as model.OptionsOf<T>), sensitive: true })
}
