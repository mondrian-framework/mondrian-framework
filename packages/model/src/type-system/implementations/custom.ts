import { decoder, types, validator } from '../../'
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
  validationOptions: validator.Options,
  options?: types.OptionsOf<types.CustomType<Name, Options, InferredAs>>,
) => validator.Result

/**
 * TODO
 */
export function custom<Name extends string, Options extends Record<string, any>, InferredAs>(
  typeName: Name,
  encode: CustomEncoder<Name, Options, InferredAs>,
  decode: CustomDecoder<Name, Options, InferredAs>,
  validate: CustomValidator<Name, Options, InferredAs>,
  options?: types.OptionsOf<types.CustomType<Name, Options, InferredAs>>,
): types.CustomType<Name, Options, InferredAs> {
  return new CustomTypeImpl(typeName, encode, decode, validate, options)
}

class CustomTypeImpl<Name extends string, Options extends Record<string, any>, InferredAs>
  extends DefaultMethods<types.CustomType<Name, Options, InferredAs>>
  implements types.CustomType<Name, Options, InferredAs>
{
  readonly kind = types.Kind.Custom
  readonly typeName: Name
  readonly encode: CustomEncoder<Name, Options, InferredAs>
  readonly decode: CustomDecoder<Name, Options, InferredAs>
  readonly validate: CustomValidator<Name, Options, InferredAs>

  getThis = () => this
  fromOptions = (options: types.OptionsOf<types.CustomType<Name, Options, InferredAs>>) =>
    custom(this.typeName, this.encode, this.decode, this.validate, options)

  constructor(
    typeName: Name,
    encode: CustomEncoder<Name, Options, InferredAs>,
    decode: CustomDecoder<Name, Options, InferredAs>,
    validate: CustomValidator<Name, Options, InferredAs>,
    options?: types.OptionsOf<types.CustomType<Name, Options, InferredAs>>,
  ) {
    super(options)
    this.typeName = typeName
    this.encode = encode
    this.decode = decode
    this.validate = validate
  }
}
