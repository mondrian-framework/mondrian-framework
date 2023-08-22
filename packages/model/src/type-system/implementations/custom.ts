import { decoder, types, validation } from '../../'
import { DefaultMethods } from './base'
import { JSONType } from '@mondrian-framework/utils'

type CustomEncoder<Name extends string, Options extends Record<string, any>, InferredAs> = (
  value: InferredAs,
  options?: types.OptionsOf<types.CustomType<Name, Options, InferredAs>>,
) => JSONType

type CustomDecoder<Name extends string, Options extends Record<string, any>, InferredAs> = (
  value: unknown,
  decodingOptions: decoder.Options,
  options?: types.OptionsOf<types.CustomType<Name, Options, InferredAs>>,
) => decoder.Result<InferredAs>

type CustomValidator<Name extends string, Options extends Record<string, any>, InferredAs> = (
  value: InferredAs,
  validationOptions?: validation.Options,
  options?: types.OptionsOf<types.CustomType<Name, Options, InferredAs>>,
) => validation.Result

/**
 * TODO
 */
export function custom<Name extends string, Options extends Record<string, any>, InferredAs>(
  typeName: Name,
  encodeWithoutValidation: CustomEncoder<Name, Options, InferredAs>,
  decode: CustomDecoder<Name, Options, InferredAs>,
  validator: CustomValidator<Name, Options, InferredAs>,
  options?: types.OptionsOf<types.CustomType<Name, Options, InferredAs>>,
): types.CustomType<Name, Options, InferredAs> {
  return new CustomTypeImpl(typeName, encodeWithoutValidation, decode, validator, options)
}

class CustomTypeImpl<Name extends string, Options extends Record<string, any>, InferredAs>
  extends DefaultMethods<types.CustomType<Name, Options, InferredAs>>
  implements types.CustomType<Name, Options, InferredAs>
{
  readonly kind = types.Kind.Custom
  readonly typeName: Name
  readonly encoder: CustomEncoder<Name, Options, InferredAs>
  readonly decode: CustomDecoder<Name, Options, InferredAs>
  readonly validator: CustomValidator<Name, Options, InferredAs>

  getThis = () => this
  fromOptions = (options: types.OptionsOf<types.CustomType<Name, Options, InferredAs>>) =>
    custom(this.typeName, this.encodeWithoutValidation, this.decode, this.validator, options)

  constructor(
    typeName: Name,
    encoder: CustomEncoder<Name, Options, InferredAs>,
    decode: CustomDecoder<Name, Options, InferredAs>,
    validator: CustomValidator<Name, Options, InferredAs>,
    options?: types.OptionsOf<types.CustomType<Name, Options, InferredAs>>,
  ) {
    super(options)
    this.typeName = typeName
    this.encoder = encoder
    this.decode = decode
    this.validator = validator
  }

  encodeWithoutValidation(value: types.Infer<types.CustomType<Name, Options, InferredAs>>): JSONType {
    return this.encoder(value, this.options)
  }

  validate(
    value: types.Infer<types.CustomType<Name, Options, InferredAs>>,
    options?: validation.Options,
  ): validation.Result {
    return this.validator(value, options, this.options)
  }
}
