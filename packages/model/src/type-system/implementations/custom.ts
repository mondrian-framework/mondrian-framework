import { decoding, types, validation } from '../../'
import { DefaultMethods } from './base'
import { JSONType } from '@mondrian-framework/utils'
import gen from 'fast-check'

type CustomEncoder<Name extends string, Options extends Record<string, any>, InferredAs> = (
  value: InferredAs,
  options?: types.OptionsOf<types.CustomType<Name, Options, InferredAs>>,
) => JSONType

type CustomDecoder<Name extends string, Options extends Record<string, any>, InferredAs> = (
  value: unknown,
  decodingOptions?: decoding.Options,
  options?: types.OptionsOf<types.CustomType<Name, Options, InferredAs>>,
) => decoding.Result<InferredAs>

type CustomValidator<Name extends string, Options extends Record<string, any>, InferredAs> = (
  value: InferredAs,
  validationOptions?: validation.Options,
  options?: types.OptionsOf<types.CustomType<Name, Options, InferredAs>>,
) => validation.Result

type CustomArbitrary<Name extends string, Options extends Record<string, any>, InferredAs> = (
  maxDepth: number,
  options?: types.OptionsOf<types.CustomType<Name, Options, InferredAs>>,
) => gen.Arbitrary<InferredAs>

/**
 * @param typeName the name of the custom type to be created
 * @param encodeWithoutValidation a function to perform encoding of the custom type
 * @param decoder a function to perform decoding of the custom type
 * @param validator a function to perform validation of the custom type
 * @param options the options that can be used to define the new custom type
 * @returns a new custom type with the provided encoding/decoding/validation functions
 * @example custom types can be useful whenever you need to define some types that are not
 *          covered by Mondrian's default types. For example, you could define the type
 *          of dates as a custom type:
 *
 *           ```ts
 *          const encoder = (date) => date.toString()
 *          const decoder = (value) => decoder.succeed(new Date(value))
 *
 *          type MyDate = types.Infer<typeof myDate> // -> Date
 *          const myDate = types.custom<"date, {}, Date>("date", encoder, decoder, validator.succeed)
 *          const value: MyDate = new Date("11-10-1998")
 *          ```
 *
 *          Custom types give you the freedom of deciding the type inferred for it so you
 *          can pick whatever best suits your needs as long as you can encode/decode it
 *          to a JSON type
 */
export function custom<Name extends string, Options extends Record<string, unknown>, InferredAs>(
  typeName: Name,
  encodeWithoutValidation: CustomEncoder<Name, Options, InferredAs>,
  decoder: CustomDecoder<Name, Options, InferredAs>,
  validator: CustomValidator<Name, Options, InferredAs>,
  arbitrary: CustomArbitrary<Name, Options, InferredAs>,
  options?: types.OptionsOf<types.CustomType<Name, Options, InferredAs>>,
): types.CustomType<Name, Options, InferredAs> {
  return new CustomTypeImpl(typeName, encodeWithoutValidation, decoder, validator, arbitrary, options)
}

class CustomTypeImpl<Name extends string, Options extends Record<string, any>, InferredAs>
  extends DefaultMethods<types.CustomType<Name, Options, InferredAs>>
  implements types.CustomType<Name, Options, InferredAs>
{
  readonly kind = types.Kind.Custom
  readonly typeName: Name
  readonly encoder: CustomEncoder<Name, Options, InferredAs>
  readonly decoder: CustomDecoder<Name, Options, InferredAs>
  readonly validator: CustomValidator<Name, Options, InferredAs>
  readonly arbitraryFromOptions: CustomArbitrary<Name, Options, InferredAs>

  getThis = () => this
  fromOptions = (options: types.OptionsOf<types.CustomType<Name, Options, InferredAs>>) =>
    custom(this.typeName, this.encodeWithNoChecks, this.decoder, this.validator, this.arbitrary, options)

  constructor(
    typeName: Name,
    encoder: CustomEncoder<Name, Options, InferredAs>,
    decoder: CustomDecoder<Name, Options, InferredAs>,
    validator: CustomValidator<Name, Options, InferredAs>,
    arbitrary: CustomArbitrary<Name, Options, InferredAs>,
    options?: types.OptionsOf<types.CustomType<Name, Options, InferredAs>>,
  ) {
    super(options)
    this.typeName = typeName
    this.encoder = encoder
    this.decoder = decoder
    this.validator = validator
    this.arbitraryFromOptions = arbitrary
  }

  encodeWithNoChecks(value: types.Infer<types.CustomType<Name, Options, InferredAs>>): JSONType {
    return this.encoder(value, this.options)
  }

  validate(
    value: types.Infer<types.CustomType<Name, Options, InferredAs>>,
    options?: validation.Options,
  ): validation.Result {
    return this.validator(value, options, this.options)
  }

  decodeWithoutValidation(value: unknown, decodingOptions?: decoding.Options | undefined): decoding.Result<InferredAs> {
    return this.decoder(value, decodingOptions, this.options)
  }

  arbitrary(maxDepth: number): gen.Arbitrary<InferredAs> {
    return this.arbitraryFromOptions(maxDepth, this.options)
  }
}
