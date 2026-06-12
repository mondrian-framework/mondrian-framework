import { AccessKey, Limit, Account } from './account.types'
import { Currency, Description, EntityId, OrganizationId } from './scalars.types'
import { addValidationLogic } from './utils'
import { model, validation } from '@mondrian-framework/model'

export const OrganizationStatus = () => model.enumeration(['ACTIVE', 'SUSPENDED'])
export type OrganizationStatus = model.Infer<typeof OrganizationStatus>

export const NetworkMembershipId = EntityId('NetworkMembership', 'netm')
export type NetworkMembershipId = model.Infer<typeof NetworkMembershipId>

export const NetworkMembership = () =>
  model.entity(
    {
      id: NetworkMembershipId,
      networkId: NetworkId,
      network: Network,
      organization: Organization,
    },
    {
      description: 'The link between a network and an organization.',
    },
  )
export type NetworkMembership = model.Infer<typeof NetworkMembership>

export const NetworkId = EntityId('Network', 'net')
export type NetworkId = model.Infer<typeof NetworkId>

export const Network = () =>
  model.entity(
    {
      id: NetworkId,
      description: Description.nullable(),

      memberships: model.array(NetworkMembership),
      currencies: model.array(Currency),
      accounts: model.array(Account),
      accessKeys: model.array(AccessKey),

      limits: model.array(Limit),
      defaultReusable: model.boolean(),

      _count: model.object(
        { accounts: model.integer(), memberships: model.integer(), accessKeys: model.integer() },
        { name: 'NetworkCount' },
      ),
    },
    {
      description: 'The network entity. Values can move only between accounts of the same network.',
      retrieve: {
        orderBy: { id: true, description: true },
        skip: true,
        take: true,
      },
    },
  )
export type Network = model.Infer<typeof Network>

export const Organization = addValidationLogic(
  'Organization',
  model.object(
    {
      id: OrganizationId,
      groupId: model.uuid().nullable(),
      code: model.string(),
      name: model.string(),
      description: model.string(),
      status: model.nullable(OrganizationStatus),
    },
    { name: 'Organization', description: 'Basic description of an organization.' },
  ),
  () => validation.succeed(),
)
export type Organization = model.Infer<typeof Organization>
