import { Account, AccessKeyId, AccessKeySearchId, AccountId, AccessKey } from './account.types'
import { NetworkId } from './network.types'
import { Currency, EntityId, TransferAmount } from './scalars.types'
import { Settlement, SettlementId } from './settlement.types'
import { model } from '@mondrian-framework/model'

export const TransferState = () => model.enumeration(['PENDING', 'COMPLETED'], { description: 'The transfer state.' })
export type TransferState = model.Infer<typeof TransferState>

export const Receipt = model.object(
  {
    externalId: model.string({ minLength: 1, maxLength: 1024 }).nullable().optional(),
    reference: model.string({ minLength: 1, maxLength: 1024 }).nullable().optional(),
    contentHTML: model
      .string({ minLength: 1, maxLength: 1024 * 1024 })
      .nullable()
      .optional(),
  },
  { name: 'Receipt', description: 'A simple receipt description that can be attached to a transfer.' },
)
export type Receipt = model.Infer<typeof Receipt>

export const TransferNote = model.string({ maxLength: 1024 })
export const TransferOrigin = model.string({ maxLength: 128 })
export const DeviceId = model.string({ maxLength: 128 })

export const TransferId = EntityId('Transfer', 'trf')
export type TransferId = model.Infer<typeof TransferId>

export const TransferKind = () => model.enumeration(['SEND', 'TOP_UP', 'SETTLEMENT', 'MOVE', 'CASH_OUT', 'REVERSAL'])
export type TransferKind = model.Infer<typeof TransferKind>

export const Transfer = () =>
  model.entity(
    {
      id: TransferId,
      networkId: NetworkId,

      currency: Currency,
      value: TransferAmount,
      createdAt: model.datetime(),
      signedAt: model.datetime().nullable(),
      accessKeyId: AccessKeyId.nullable(),
      accessKey: model.nullable(AccessKey),
      state: TransferState,

      senderAccountId: AccountId.nullable(),
      senderAccount: model.nullable(Account),
      receiverAccountId: AccountId,
      receiverAccount: Account,

      settlementId: SettlementId.nullable(),
      settlement: model.nullable(Settlement),
      kind: model.nullable(TransferKind),
    },
    {
      description: 'The transfer entity. Represents the movement of value between two accounts.',
      retrieve: {
        orderBy: { id: true, createdAt: true, signedAt: true, value: true },
        where: { state: true, kind: true },
        skip: true,
        take: true,
      },
    },
  )
export type Transfer = model.Infer<typeof Transfer>

export const TransferWithDetails = () =>
  model.entity(
    {
      id: TransferId,
      networkId: NetworkId,

      currency: Currency,
      value: TransferAmount,
      createdAt: model.datetime(),
      signedAt: model.datetime().nullable(),
      accessKeyId: AccessKeyId.nullable(),
      accessKey: model.nullable(AccessKey),
      state: TransferState,

      note: TransferNote.nullable(),
      origin: TransferOrigin.nullable(),
      device: DeviceId.nullable(),
      receipt: Receipt.nullable(),

      senderAccountId: AccountId.nullable(),
      senderAccount: model.nullable(Account),
      receiverAccountId: AccountId,
      receiverAccount: Account,

      settlementId: SettlementId.nullable(),
      settlement: model.nullable(Settlement),
      kind: model.nullable(TransferKind),
    },
    {
      description:
        'The transfer entity with details (note, origin, device and receipt). Represents the movement of value between two accounts.',
      retrieve: {
        orderBy: { id: true, createdAt: true, signedAt: true, value: true },
        skip: true,
        take: true,
      },
    },
  )
export type TransferWithDetails = model.Infer<typeof TransferWithDetails>

export const SyncAuthorization = () =>
  model.object({
    accessKeyId: AccessKeySearchId,
    secret: model.string().optional(),
  })
export type SyncAuthorization = model.Infer<typeof SyncAuthorization>
