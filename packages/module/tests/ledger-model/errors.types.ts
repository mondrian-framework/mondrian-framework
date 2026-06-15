import { error } from '../../src'
import { Limit } from './account.types'
import { OrganizationId } from './scalars.types'
import { model } from '@mondrian-framework/model'

export const {
  BadRequest,
  LockedResource,
  TransferRejected,
  Forbidden,
  MembershipExpired,
  Unknown,
  Unauthorized,
  LimitOutOfBound,
  ExternalIdAlreadyExists,
} = error.define({
  Unauthorized: { message: 'Authorization required', reason: model.string() },
  Forbidden: { message: 'Not allowed', reason: model.string() },
  Unknown: { message: 'Unknown error', details: model.unknown() },
  BadRequest: { message: 'Bad request', reason: model.string().optional() },
  MembershipExpired: {
    message: 'Membership expired',
    organizationIds: OrganizationId.array({
      description: 'The organizations that need an active membership for the failed operation',
    }),
  },
  LockedResource: { message: 'Resource is locked', reason: model.string() },
  TransferRejected: { message: 'Transfer rejected', reason: model.string() },
  LimitOutOfBound: {
    message: 'Limit out of bound',
    limit: Limit,
    from: model.enumeration(['accessKey', 'network', 'account']),
    windowed: model.object({ spent: model.integer().optional(), remaining: model.integer().optional() }).optional(),
  },
  ExternalIdAlreadyExists: {
    message: 'External id already exists',
    externalId: model.string().optional(),
    externalIds: model.array(model.string()).optional(),
  },
})

export type Unauthorized = model.Infer<typeof Unauthorized>
export type Forbidden = model.Infer<typeof Forbidden>
export type Unknown = model.Infer<typeof Unknown>
export type BadRequest = model.Infer<typeof BadRequest>
export type MembershipExpired = model.Infer<typeof MembershipExpired>
export type LockedResource = model.Infer<typeof LockedResource>
export type TransferRejected = model.Infer<typeof TransferRejected>
export type LimitOutOfBound = model.Infer<typeof LimitOutOfBound>
export type ExternalIdAlreadyExists = model.Infer<typeof ExternalIdAlreadyExists>
