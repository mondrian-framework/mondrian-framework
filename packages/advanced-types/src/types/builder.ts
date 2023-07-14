import { DecodingOptions, m } from '@mondrian-framework/model'
import { Result, error, success } from '@mondrian-framework/model/src/result'

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
  _decodingOptions: DecodingOptions,
  _options?: m.OptionsOf<m.CustomType<Name, Options, string>>,
): Result<string> {
  return typeof value === 'string' ? success(value) : error('Expected a string value', value)
}

function validate(input: string, errorMessage: string, regexes: RegExp[]): Result<true> {
  return regexes.some((regex) => regex.test(input)) ? success(true) : error(errorMessage, input)
}
