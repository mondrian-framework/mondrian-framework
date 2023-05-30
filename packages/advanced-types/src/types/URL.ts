import { m, CustomTypeOpts, Result } from '@mondrian-framework/model'

export function URLType(opts?: CustomTypeOpts) {
  return m.custom(
    {
      name: 'URL',
      encodedType: m.string(),
      decode: (input, opts, decodeOpts) => {
        try {
          return Result.success(new URL(input))
        } catch (e) {
          return Result.error('Invalid URL format (RFC 3986)', input)
        }
      },
      encode: (input, opts) => {
        return input.toString()
      },
      validate(input) {
        if (!(input instanceof URL)) {
          return Result.error('URL expected', input)
        }
        return Result.success(input)
      },
    },
    opts,
  )
}
