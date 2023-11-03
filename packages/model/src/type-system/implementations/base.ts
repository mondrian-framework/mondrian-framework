import { decoding, encoding, result, types, validation } from '../../'
import { JSONType } from '@mondrian-framework/utils'
import gen from 'fast-check'
import prand from 'pure-rand'

export abstract class DefaultMethods<T extends types.Type> {
  readonly options?: types.OptionsOf<T>

  constructor(options: types.OptionsOf<T> | undefined) {
    this.options = options
  }

  abstract getThis(): T
  abstract fromOptions(options?: types.OptionsOf<T>): T
  abstract encodeWithNoChecks(value: types.Infer<T>, encodingOptions?: encoding.Options): JSONType
  abstract decodeWithoutValidation(value: unknown, decodingOptions?: decoding.Options): decoding.Result<types.Infer<T>>
  abstract validate(value: types.Infer<T>, validationOptions?: validation.Options): validation.Result
  abstract arbitrary(maxDepth: number): gen.Arbitrary<types.Infer<T>>

  encodeWithoutValidation(value: types.Infer<T>, encodingOptions?: encoding.Options): JSONType {
    return encodingOptions?.sensitiveInformationStrategy === 'hide'
      ? null
      : this.encodeWithNoChecks(value, encodingOptions)
  }

  encode(
    value: types.Infer<T>,
    encodignOptions?: encoding.Options,
    validationOptions?: validation.Options,
  ): result.Result<JSONType, validation.Error[]> {
    return types
      .concretise(this.getThis())
      .validate(value as never, validationOptions)
      .replace(this.encodeWithoutValidation(value, encodignOptions))
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

  example(args?: { maxDepth?: number; seed?: number }): types.Infer<T> {
    const randomSeed = args?.seed ?? Date.now() ^ (Math.random() * 0x100000000)
    const random = new gen.Random(prand.xoroshiro128plus(randomSeed))
    const value = this.arbitrary(args?.maxDepth ?? 1).generate(random, undefined)
    return value.value
  }

  optional = (options: types.OptionalTypeOptions) => types.optional(this.getThis(), options)
  nullable = (options: types.NullableTypeOptions) => types.nullable(this.getThis(), options)
  array = (options: types.ArrayTypeOptions) => types.array(this.getThis(), options)
  equals = (other: types.Type) => types.areEqual(this.getThis(), other)

  setOptions = (options: types.OptionsOf<T>) => this.fromOptions(options)
  updateOptions = (options: types.OptionsOf<T>) => this.fromOptions({ ...this.options, ...options })
  setName = (name: string) => this.fromOptions({ ...(this.options as types.OptionsOf<T>), name })
  sensitive = () => this.fromOptions({ ...(this.options as types.OptionsOf<T>), sensitive: true })
}
