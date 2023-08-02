import { m, decoder, validator } from '@mondrian-framework/model'
import { result } from '@mondrian-framework/model'

export function fromRegexes<Name extends string, Options extends Record<string, any>>(
  typeName: Name,
  errorMessage: string,
  options: m.OptionsOf<m.CustomType<Name, Options, string>> | undefined,
  regex: RegExp,
  ...regexes: RegExp[]
): m.CustomType<Name, Options, string> {
  return m.custom(typeName, encode, decode, (input) => validate(input, errorMessage, [regex, ...regexes]), options)
}

function encode(string: string): string {
  return string
}

function decode<Name extends string, Options extends Record<string, any>>(
  value: unknown,
  _decodingOptions: decoder.Options,
  _options?: m.OptionsOf<m.CustomType<Name, Options, string>>,
): decoder.Result<string> {
  return typeof value === 'string' ? decoder.succeed(value) : decoder.baseFail('Expected a string value', value)
}

function validate(input: string, errorMessage: string, regexes: RegExp[]): validator.Result {
  return regexes.some((regex) => regex.test(input)) ? validator.succeed() : validator.baseFail(errorMessage, input)
}
