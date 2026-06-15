import { NetworkId, Organization } from './network.types'
import { Currency, EntityId, OrganizationId, TransferAmount } from './scalars.types'
import { Transfer } from './transfer.types'
import { model } from '@mondrian-framework/model'

export const SettlementId = EntityId('Settlement', 'stl')
export type SettlementId = model.Infer<typeof SettlementId>

export const SettlementMovementId = EntityId('SettlementMovement', 'stlm')
export type SettlementMovementId = model.Infer<typeof SettlementMovementId>

export const SettlementNote = model.string({ maxLength: 1024 })
export type SettlementNote = model.Infer<typeof SettlementNote>

export const Settlement = () =>
  model.entity(
    {
      id: SettlementId,
      networkId: NetworkId,

      from: model.datetime(),
      to: model.datetime(),
      currency: Currency,

      movements: model.array(SettlementMovement),
      transfers: model.array(Transfer),
    },
    {
      description:
        'The settlement entity. It describes the movements between accounts and organizations in order to settle debits and credits between different organizations.',
      retrieve: { orderBy: { id: true }, skip: true, take: true },
    },
  )
export type Settlement = model.Infer<typeof Settlement>

export const SettlementMovement = () =>
  model.entity(
    {
      id: SettlementMovementId,
      networkId: NetworkId,

      settlementId: SettlementId,
      settlement: Settlement,

      fromOrganizationId: OrganizationId,
      fromOrganization: Organization,
      toOrganizationId: OrganizationId,
      toOrganization: Organization,
      value: TransferAmount,
      state: SettlementMovementState,
      note: SettlementNote.nullable(),
    },
    {
      description: 'The movement between two organizations. This movement is performed outside of the system.',
    },
  )
export type SettlementMovement = model.Infer<typeof SettlementMovement>

export const SettlementMovementState = () =>
  model.enumeration(['PENDING', 'COMPLETED'], {
    description: 'The state of the settlement movement.',
  })
export type SettlementMovementState = model.Infer<typeof SettlementMovementState>
