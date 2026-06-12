import { error, functions } from '../../src'
import {
  LimitInput,
  Account,
  AccessKeyExternalIdInput,
  AccessKeySearchId,
  AccessKeyType,
  AccountId,
  AccountType,
} from './account.types'
import { BadRequest, Forbidden, Unauthorized, ExternalIdAlreadyExists, MembershipExpired } from './errors.types'
import { NetworkId } from './network.types'
import { Description, OrganizationId, PublicKey, AccountHolder } from './scalars.types'
import { model } from '@mondrian-framework/model'

const EmbeddedAccessKeyInput = model.object(
  {
    type: AccessKeyType,
    reusable: model.boolean().optional(),
    secret: model.string({ minLength: 1, maxLength: 4096 }).nullable().optional(),
    publicKey: PublicKey.nullable().optional(),
    externalId: AccessKeyExternalIdInput.nullable().optional(),
    limits: LimitInput.optional(),
  },
  { name: 'EmbeddedAccessKeyInput' },
)

export const createAccount = functions.define({
  input: model.object(
    {
      networkId: NetworkId,
      type: AccountType,
      organizationId: OrganizationId.nullable().optional(),
      limits: LimitInput.optional(),
      description: Description.optional(),
      holder: AccountHolder.optional(),
      accessKey: EmbeddedAccessKeyInput.optional(),
    },
    { name: 'AccountInput' },
  ),
  output: Account,
  retrieve: { select: true },
  errors: {
    Forbidden,
    BadInput: error.standard.BadInput,
    BadRequest,
    Unauthorized,
    ExternalIdAlreadyExists,
    MembershipExpired,
  },
  options: {
    namespace: 'account',
    description: `Creates a new account for a network. The account can be of different types (PREPAID or OVERDRAFT) and can be associated with an organization.`,
  },
})

export const createAccounts = functions.define({
  input: model.object(
    {
      networkId: NetworkId,
      accounts: model.array(
        model.object({
          type: AccountType,
          organizationId: OrganizationId.optional(),
          limits: LimitInput.optional(),
          description: Description.optional(),
          holder: AccountHolder.optional(),
          accessKey: EmbeddedAccessKeyInput.optional(),
        }),
        { minItems: 1, maxItems: 100 },
      ),
    },
    { name: 'AccountsInput' },
  ),
  output: model.array(Account),
  retrieve: { select: true },
  errors: {
    Forbidden,
    BadInput: error.standard.BadInput,
    BadRequest,
    Unauthorized,
    ExternalIdAlreadyExists,
    MembershipExpired,
  },
  options: {
    namespace: 'account',
    description: `Creates some accounts for a network. The accounts can be of different types (PREPAID or OVERDRAFT) and can be associated with an organization.`,
  },
})

export const getAccounts = functions.define({
  input: model.object(
    {
      networkId: NetworkId,
      type: model.optional(AccountType),
      ids: AccountId.array({ minItems: 1, maxItems: 20, distinct: true }).mutable().optional(),
      organizationIds: OrganizationId.array({ minItems: 1, maxItems: 20, distinct: true }).mutable().optional(),
      isOrganizationSet: model.boolean().optional(),
      accessKeyIds: AccessKeySearchId.array({ minItems: 1, maxItems: 20, distinct: true }).mutable().optional(),
      holder: AccountHolder.optional(),
      search: model.string({ maxLength: 1024, description: 'Search account based on description' }).optional(),
      searchByAccessKeyExternalId: model
        .string({ maxLength: 1024, description: 'Search by prefix of externalId of the attached access keys' })
        .optional(),
    },
    { name: 'GetAccountsInput' },
  ),
  output: model.array(Account, { totalCount: true }),
  retrieve: { select: true, orderBy: true, skip: true, take: true },
  errors: { Forbidden, Unauthorized, BadRequest, BadInput: error.standard.BadInput, MembershipExpired },
  options: {
    namespace: 'account',
    description: `Retrieves accounts based on network and type. The id can be used to retrieve a specific account.`,
  },
})

export const updateAccount = functions.define({
  input: model.object(
    {
      networkId: NetworkId,
      accountId: AccountId,
      update: model
        .object({
          limits: LimitInput.optional(),
          description: Description.optional(),
          holder: AccountHolder.optional(),
        })
        .optional(),
      unset: model
        .object({
          description: model.literal(true).optional(),
          holder: model.literal(true).optional(),
        })
        .optional(),
    },
    { name: 'UpdateAccountInput' },
  ),
  output: Account,
  retrieve: { select: true },
  errors: { BadRequest, Forbidden, BadInput: error.standard.BadInput, Unauthorized, MembershipExpired },
  options: {
    namespace: 'account',
    description: `Updates an account.`,
  },
})
