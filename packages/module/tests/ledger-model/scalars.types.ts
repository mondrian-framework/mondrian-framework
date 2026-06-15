import { decoding, model } from '@mondrian-framework/model'
import gen from 'fast-check'

export const ObjectId = model.string({
  regex: /^[0-9a-f]{24}$/,
  description: '12 bytes (hex)',
  name: 'ObjectId',
})
export type ObjectId = model.Infer<typeof ObjectId>

export const EntityId = <Name extends string>(entityName: Name, prefix: string) =>
  model.custom<`${Name}Id`, {}, string>({
    typeName: `${entityName}Id`,
    options: {
      apiType: model.string({
        regex: new RegExp(`^${prefix}_[0-9a-f]{24}$`),
        name: `${entityName}Id`,
        description: `Identifier for a ${entityName} entity. It is composed by the prefix "${prefix}_" and a valid ObjectId.`,
      }),
    },
    decoder(value) {
      if (typeof value !== 'string') {
        return decoding.fail('string', value)
      }
      const splitted = value.split('_')
      if (splitted.length === 2) {
        if (splitted[0] !== prefix) {
          return decoding.fail(`ObjectId starting with "${prefix}_" or a plain ObjectId`, value)
        }
        return decoding.succeed(splitted[1])
      }
      return decoding.succeed(value)
    },
    encoder(value) {
      if (value.startsWith(`${prefix}_`)) {
        return value
      } else {
        return `${prefix}_${value}`
      }
    },
    validator(value) {
      return ObjectId.validate(value).mapError((errors) =>
        errors.map((error) => ({ ...error, assertion: `After "${prefix}_" prefix a valid ObjectId is expected.` })),
      )
    },
    arbitrary() {
      return gen.stringMatching(/^[0-9a-f]{24}$/).map((id) => `${prefix}_${id}`)
    },
  })

export const SupportedCurrencies = [
  'EUR',
  'USD',
  'GBP',
  'CAD',
  'CHF',
  'HRK',
  'PLN',
  'CZK',
  'BGN',
  'HUF',
  'RON',
  'LTL',
  'DKK',
  'SEK',
  'NOK',
  'RUB',
  'AED',
  'BHD',
] as const
export const Currency = () => model.enumeration(SupportedCurrencies, { description: "The currency's ISO 4217 code." })
export type Currency = model.Infer<typeof Currency>

export const BalanceAmount = () =>
  model.integer({
    maximum: 999_999_999_999_999,
    minimum: -999_999_999_999_999,
    description: 'The account balance in the smallest unit of the currency (e.g. cents, pence, etc.)',
  })
export type BalanceAmount = model.Infer<typeof BalanceAmount>

export const TransferAmount = () =>
  model.integer({
    maximum: 9_999_999_999,
    minimum: 0,
    description: 'The transfer value in the smallest unit of the currency (e.g. cents, pence, etc.)',
  })
export type TransferAmount = model.Infer<typeof TransferAmount>

export const OrganizationId = model.uuid({ description: 'An organization id.' })
export type OrganizationId = model.Infer<typeof OrganizationId>

export const Description = model.string({ description: 'Description for searching capabilities', maxLength: 1024 })
export type Description = model.Infer<typeof Description>

export const AccountHolder = model.string({ description: 'The holder of the account', maxLength: 1024 })
export type AccountHolder = model.Infer<typeof AccountHolder>

export const PublicKey = model.string({
  regex: new RegExp('^-----BEGIN RSA PUBLIC KEY-----\n.*\n-----END RSA PUBLIC KEY-----\n?$', 's'),
  name: 'RSAPublicKey',
  description: 'An RSA public key (2048 bit)',
})
export type PublicKey = model.Infer<typeof PublicKey>

export const PrivateKey = model.string({
  regex: new RegExp('^-----BEGIN RSA PRIVATE KEY-----\n.*\n-----END RSA PRIVATE KEY-----\n?$', 's'),
  name: 'RSAPrivateKey',
  description: 'An RSA private key (2048 bit)',
})
export type PrivateKey = model.Infer<typeof PrivateKey>
