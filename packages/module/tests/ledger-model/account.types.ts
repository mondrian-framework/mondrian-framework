import { Network, NetworkId, Organization } from './network.types'
import {
  AccountHolder,
  BalanceAmount,
  Currency,
  Description,
  EntityId,
  ObjectId,
  OrganizationId,
  PublicKey,
  SupportedCurrencies,
  TransferAmount,
} from './scalars.types'
import { Transfer } from './transfer.types'
import { addValidationLogic } from './utils'
import { decoding, model, validation } from '@mondrian-framework/model'
import gen from 'fast-check'

export const AccountType = () =>
  model.enumeration(['OVERDRAFT', 'PREPAID'], {
    description: "The account's type. OVERDRAFT can go under 0, PREPAID cannot.",
  })
export type AccountType = model.Infer<typeof AccountType>

export const AccessKeyType = () =>
  model.enumeration(['NONE', 'SHARED', 'KEYPAIR'], {
    description:
      'The access key type. NONE has no authorization, SHARED uses a symmetric key, KEYPAIR uses an asymmetric key-pair.',
  })
export type AccessKeyType = model.Infer<typeof AccessKeyType>

export const AccountBalance = () =>
  model.object(
    {
      EUR: model.nullable(BalanceAmount),
      USD: model.nullable(BalanceAmount),
      GBP: model.nullable(BalanceAmount),
      CAD: model.nullable(BalanceAmount),
      CHF: model.nullable(BalanceAmount),
      HRK: model.nullable(BalanceAmount),
      PLN: model.nullable(BalanceAmount),
      CZK: model.nullable(BalanceAmount),
      BGN: model.nullable(BalanceAmount),
      HUF: model.nullable(BalanceAmount),
      RON: model.nullable(BalanceAmount),
      LTL: model.nullable(BalanceAmount),
      DKK: model.nullable(BalanceAmount),
      SEK: model.nullable(BalanceAmount),
      NOK: model.nullable(BalanceAmount),
      RUB: model.nullable(BalanceAmount),
      AED: model.nullable(BalanceAmount),
      BHD: model.nullable(BalanceAmount),
    },
    { description: 'The account balance for each currency' },
  )
export type AccountBalance = model.Infer<typeof AccountBalance>

export const LimitType = () =>
  model.enumeration(['ABSOLUTE', 'WINDOWED'], {
    description: `The limit type.
ABSOLUTE limits the maximum expenditure in a single transfer\n
WINDOWED limits the maximum expenditure in a sliding time window of 24 hours.`,
  })
export type LimitType = model.Infer<typeof LimitType>

export const LimitScope = () =>
  model.enumeration(['SEND', 'MOVE', 'TOP_UP'], {
    description: 'The limit scope. SEND is the default if not specified.',
  })
export type LimitScope = model.Infer<typeof LimitScope>

export const Limit = () =>
  model.object(
    {
      type: LimitType,
      currency: Currency,
      min: model.nullable(TransferAmount).optional(),
      max: model.nullable(TransferAmount).optional(),
      scope: model.nullable(LimitScope).optional(),
    },
    {
      description:
        'Limits the maximum transfer value inside a network for each currency. The default scope if omitted is SEND',
    },
  )
export type Limit = model.Infer<typeof Limit>

export const LimitInput = model.mutableArray(Limit, {
  maxItems: SupportedCurrencies.length * LimitType().variants.length * LimitScope().variants.length,
})
export type LimitInput = model.Infer<typeof LimitInput>

export const AccountId = EntityId('Account', 'acc')
export type AccountId = model.Infer<typeof AccountId>

export const Account = () =>
  model.entity(
    {
      id: AccountId,
      networkId: NetworkId,
      network: Network,
      sequence: model.integer({ minimum: 1 }),

      type: AccountType,
      balance: AccountBalance,
      outgoing: model.array(Transfer),
      incoming: model.array(Transfer),
      description: Description.nullable(),

      accessKeys: model.array(AccessKey),

      organizationId: OrganizationId.nullable(),
      organization: Organization.nullable(),
      holder: AccountHolder.nullable(),

      limits: model.array(Limit),

      _count: model.object(
        { outgoing: model.integer(), incoming: model.integer(), accessKeys: model.integer() },
        { name: 'AccountCount' },
      ),
    },
    {
      description: "An account is a container of value and it's used to send and receive transfers.",
      retrieve: {
        where: { organizationId: true, type: true },
        orderBy: { id: true, type: true },
        skip: true,
        take: true,
      },
    },
  )
export type Account = model.Infer<typeof Account>

export const AccessKeyExternalIdInput = addValidationLogic(
  'AccessKeyExternalIdInput',
  model.string({
    regex: /^[\x20-\x7E]{1,1024}$/,
    description:
      'An external id that can be used to identify the access key. Must be unique inside a network and cannot be the same format as the system id (key_123412341234123412341234).',
    name: 'AccessKeyExternalIdInput',
  }),
  (value) => {
    const splitted = value.split('_')
    if (splitted.length === 2 && splitted[0] === 'key' && ObjectId.validate(splitted[1]).isOk) {
      return validation.fail('The external id cannot have the same format of the system id', value)
    } else {
      return validation.succeed()
    }
  },
)
export type AccessKeyExternalIdInput = model.Infer<typeof AccessKeyExternalIdInput>

export const AccessKeyId = EntityId('AccessKey', 'key')
export type AccessKeyId = model.Infer<typeof AccessKeyId>

export const AccessKeySearchId = model.custom<`AccessKeySearchId`, {}, string>({
  typeName: `AccessKeySearchId`,
  options: {
    apiType: model.string({
      regex: /^[\x20-\x7E]{1,1024}$/,
      name: `AccessKeySearchId`,
      description: `Identifier for an AccessKey entity. Either the external or system id.`,
    }),
  },
  decoder(value) {
    if (typeof value !== 'string') {
      return decoding.fail('string', value)
    }
    const splitted = value.split('_')
    if (splitted.length === 2 && splitted[0] === 'key' && ObjectId.validate(splitted[1]).isOk) {
      return decoding.succeed(splitted[1])
    }
    return decoding.succeed(value)
  },
  encoder(value) {
    return value
  },
  validator() {
    return validation.succeed()
  },
  arbitrary() {
    return gen.stringMatching(/^[0-9a-f]{8}$/).map((id) => `${id}`)
  },
})

export type AccessKeySearchId = model.Infer<typeof AccessKeySearchId>

export const AccessKey = () =>
  model.entity(
    {
      id: AccessKeyId,
      externalId: AccessKeyExternalIdInput,
      networkId: NetworkId,
      network: Network,
      reusable: model.boolean(),
      description: Description.nullable(),
      type: AccessKeyType,
      secret: model.string({ minLength: 1 }).nullable(),
      publicKey: PublicKey.nullable(),
      accountId: AccountId.nullable(),
      account: model.nullable(Account),
      limits: model.array(Limit),
      deletedAt: model.datetime().nullable(),
      deleteReason: model.string().nullable(),
    },
    {
      description: 'An access key is a way to authorize a transfer. It can be a shared secret, a key-pair or none',
      retrieve: {
        orderBy: { id: true, type: true },
        take: true,
        skip: true,
      },
    },
  )
export type AccessKey = model.Infer<typeof AccessKey>
