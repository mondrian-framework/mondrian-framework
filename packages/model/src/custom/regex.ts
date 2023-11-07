import { decoding, types, validation } from '..'
import gen from 'fast-check'

export function fromRegexes<Name extends string, Options extends Record<string, any>>(
  typeName: Name,
  errorMessage: string,
  options: types.OptionsOf<types.CustomType<Name, Options, string>> | undefined,
  arbitrary: gen.Arbitrary<string> | undefined,
  regex: RegExp,
  ...regexes: RegExp[]
): types.CustomType<Name, Options, string> {
  return types.custom(
    typeName,
    encode,
    decode,
    (input) => validate(input, errorMessage, [regex, ...regexes]),
    () => arbitrary ?? gen.stringMatching(regex),
    options,
  )
}

function encode(string: string): string {
  return string
}

function decode<Name extends string, Options extends Record<string, any>>(
  value: unknown,
  _decodingOptions?: decoding.Options,
  _options?: types.OptionsOf<types.CustomType<Name, Options, string>>,
): decoding.Result<string> {
  return typeof value === 'string' ? decoding.succeed(value) : decoding.fail('Expected a string value', value)
}

function validate(input: string, errorMessage: string, regexes: RegExp[]): validation.Result {
  return regexes.some((regex) => regex.test(input)) ? validation.succeed() : validation.fail(errorMessage, input)
}
