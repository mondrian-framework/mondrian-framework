import { decoding, model, validation } from '../..'
import { DefaultMethods } from './base'
import { JSONType } from '@mondrian-framework/utils'
import gen from 'fast-check'

type CustomEncoder<Options extends Record<string, any>, InferredAs> = (
  value: InferredAs,
  options?: model.CustomTypeOptions<Options>,
) => JSONType

type CustomDecoder<Options extends Record<string, any>, InferredAs> = (
  value: unknown,
  decodingOptions: decoding.Options,
  options?: model.CustomTypeOptions<Options>,
) => decoding.Result<InferredAs>

type CustomValidator<Options extends Record<string, any>, InferredAs> = (
  value: InferredAs,
  validationOptions?: validation.Options,
  options?: model.CustomTypeOptions<Options>,
) => validation.Result

type CustomArbitrary<Options extends Record<string, any>, InferredAs> = (
  maxDepth: number,
  options?: model.CustomTypeOptions<Options>,
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
 *          type MyDate = model.Infer<typeof myDate> // -> Date
 *          const myDate = model.custom<"date, {}, Date>("date", encoder, decoder, validator.succeed)
 *          const value: MyDate = new Date("11-10-1998")
 *          ```
 *
 *          Custom types give you the freedom of deciding the type inferred for it so you
 *          can pick whatever best suits your needs as long as you can encode/decode it
 *          to a JSON type
 */
export function custom<Name extends string, Options extends Record<string, unknown>, InferredAs>(
  typeName: Name,
  encodeWithoutValidation: CustomEncoder<Options, InferredAs>,
  decoder: CustomDecoder<Options, InferredAs>,
  validator: CustomValidator<Options, InferredAs>,
  arbitrary: CustomArbitrary<Options, InferredAs>,
  options?: model.CustomTypeOptions<Options>,
): model.CustomType<Name, Options, InferredAs> {
  return new CustomTypeImpl(typeName, encodeWithoutValidation, decoder, validator, arbitrary, options)
}

class CustomTypeImpl<Name extends string, Options extends Record<string, any>, InferredAs>
  extends DefaultMethods<model.CustomType<Name, Options, InferredAs>>
  implements model.CustomType<Name, Options, InferredAs>
{
  readonly kind = model.Kind.Custom
  readonly typeName: Name
  readonly encoder: CustomEncoder<Options, InferredAs>
  readonly decoder: CustomDecoder<Options, InferredAs>
  readonly validator: CustomValidator<Options, InferredAs>
  readonly arbitraryFromOptions: CustomArbitrary<Options, InferredAs>

  getThis = () => this
  fromOptions = (options: model.CustomTypeOptions<Options>) =>
    custom(this.typeName, this.encodeWithoutValidationInternal, this.decoder, this.validator, this.arbitrary, options)

  constructor(
    typeName: Name,
    encoder: CustomEncoder<Options, InferredAs>,
    decoder: CustomDecoder<Options, InferredAs>,
    validator: CustomValidator<Options, InferredAs>,
    arbitrary: CustomArbitrary<Options, InferredAs>,
    options?: model.CustomTypeOptions<Options>,
  ) {
    super(options)
    this.typeName = typeName
    this.encoder = encoder
    this.decoder = decoder
    this.validator = validator
    this.arbitraryFromOptions = arbitrary
  }

  encodeWithoutValidationInternal(value: model.Infer<model.CustomType<Name, Options, InferredAs>>): JSONType {
    return this.encoder(value, this.options)
  }

  validate(
    value: model.Infer<model.CustomType<Name, Options, InferredAs>>,
    options?: validation.Options,
  ): validation.Result {
    return this.validator(value, options, this.options)
  }

  decodeWithoutValidationInternal(value: unknown, options: Required<decoding.Options>): decoding.Result<InferredAs> {
    return this.decoder(value, options, this.options)
  }

  arbitrary(maxDepth: number): gen.Arbitrary<InferredAs> {
    return this.arbitraryFromOptions(maxDepth, this.options)
  }
}
