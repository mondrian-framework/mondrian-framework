/**
 * Type-level regression test for https://github.com/microsoft/TypeScript/issues/53614
 *
 * tsc (5.3.3/5.4.2) and tsserver used to disagree on the inference of the `OrderBy` /
 * `OrderByArray` conditional types over a recursive entity graph (union order dependence):
 * tsc resolved the orderBy of an array relation reached through a nullable entity as
 * `'asc' | 'desc' | undefined` instead of `{ readonly _count?: 'asc' | 'desc' | undefined } | undefined`.
 * That forced an `: any` fallback workaround in `packages/module/src/retrieve.ts`.
 * The workaround has been removed (`: SortDirection` fallback restored); this file locks in the
 * correct inference using a fictional ledger domain model (under `./ledger-model`) that exercises
 * the same type-level structure as the model in the original report: an array-of-entity relation
 * (`outgoing`), reached through the root select, whose orderBy crosses a nullable entity
 * (`settlement`) into another array-of-entity relation (`transfers`).
 *
 * This file is verified by `tsc` through vitest's typecheck (see `test.typecheck` in the root
 * `vite.config.ts`), which runs as part of `npx vitest run` at the repository root (CI).
 */
import { retrieve } from '../src'
import { getAccounts } from './ledger-model/account.definitions'
import { Account } from './ledger-model/account.types'
import { model } from '@mondrian-framework/model'
import { describe, expectTypeOf, test } from 'vitest'

// The retrieve type seen by a `getAccounts` implementation:
// output `model.array(Account, { totalCount: true })`, capabilities { select, orderBy, skip, take }.
const GetAccountsOutput = model.array(Account, { totalCount: true })
type GetAccountsRetrieve = retrieve.FromType<
  typeof GetAccountsOutput,
  { select: true; orderBy: true; skip: true; take: true }
>
declare const r: GetAccountsRetrieve

type AccountOrderBy = NonNullable<GetAccountsRetrieve['orderBy']>[number]
type TransferOrderBy = NonNullable<
  NonNullable<NonNullable<GetAccountsRetrieve['select']>['outgoing']>['orderBy']
>[number]

describe('retrieve.FromType orderBy inference on the ledger model (TS#53614 regression)', () => {
  test('orderBy of an array relation reached through a nullable entity is the _count object', () => {
    // Same shape as the pattern from the issue report: Account.outgoing -> Transfer.settlement
    // (nullable entity) -> Settlement.transfers (array of entity). Buggy tsc inferred
    // `typeof test` as 'asc' | 'desc' | undefined, so this object literal assignment failed
    // with TS2322.
    const test = (r.select?.outgoing?.orderBy ?? [])[0].settlement?.transfers
    const test1: typeof test = { _count: 'asc' }
    expectTypeOf<typeof test>().toEqualTypeOf<{ readonly _count?: 'asc' | 'desc' | undefined } | undefined>()
    // note: `typeof test1` narrows away `undefined` because of the literal initializer
    expectTypeOf<typeof test1>().toEqualTypeOf<{ readonly _count?: 'asc' | 'desc' | undefined }>()

    // Guards against silently reintroducing the `: any` workaround: if `typeof test` degraded to
    // `any` these assignments would compile and the unused '@ts-expect-error' would be an error.
    // @ts-expect-error an invalid sort direction literal must be rejected
    const invalidLiteral: typeof test = { _count: 'invalid-literal' }
    // @ts-expect-error a number is not a sort direction
    const invalidNumber: typeof test = { _count: 123 }
  })

  test('the same pattern type-checks inside a real function implementation (original report context)', () => {
    getAccounts.implement({
      async body({ retrieve: rr }) {
        const test = (rr.select?.outgoing?.orderBy ?? [])[0].settlement?.transfers
        const test1: typeof test = { _count: 'asc' }
        expectTypeOf<typeof test>().toEqualTypeOf<{ readonly _count?: 'asc' | 'desc' | undefined } | undefined>()
        expectTypeOf<typeof test1>().toEqualTypeOf<{ readonly _count?: 'asc' | 'desc' | undefined }>()
        throw new Error('type-level test only, never executed')
      },
    })
  })

  test('orderBy of scalar fields is SortDirection (including custom types, the old `any` fallback branch)', () => {
    // `id` is an `EntityId` custom type: it resolves through the conditional-type fallback branch
    // that the workaround had degraded to `any`.
    expectTypeOf<AccountOrderBy['id']>().toEqualTypeOf<'asc' | 'desc' | undefined>()
    expectTypeOf<AccountOrderBy['type']>().toEqualTypeOf<'asc' | 'desc' | undefined>()
    expectTypeOf<AccountOrderBy['type']>().toEqualTypeOf<retrieve.SortDirection | undefined>()
    expectTypeOf<TransferOrderBy['createdAt']>().toEqualTypeOf<'asc' | 'desc' | undefined>()
    const scalarOrder: AccountOrderBy = { id: 'asc', type: 'desc' }
    // @ts-expect-error a scalar orderBy entry only accepts 'asc' | 'desc'
    const invalidScalarOrder: AccountOrderBy = { id: 'ascending' }
  })

  test('orderBy of a top-level array relation is the _count object', () => {
    expectTypeOf<AccountOrderBy['outgoing']>().toEqualTypeOf<
      { readonly _count?: 'asc' | 'desc' | undefined } | undefined
    >()
    const arrayOrder: AccountOrderBy = { outgoing: { _count: 'desc' } }
    // @ts-expect-error an array relation orderBy entry is not a plain SortDirection
    const invalidArrayOrder: AccountOrderBy = { outgoing: 'asc' }
  })

  test('orderBy resolves recursively through nullable entity paths (outgoing -> senderAccount -> network)', () => {
    type NetworkDescriptionOrder = NonNullable<NonNullable<TransferOrderBy['senderAccount']>['network']>['description']
    expectTypeOf<NetworkDescriptionOrder>().toEqualTypeOf<'asc' | 'desc' | undefined>()
    const nestedOrder: TransferOrderBy = { senderAccount: { network: { description: 'asc' }, sequence: 'desc' } }
    // @ts-expect-error nested scalar orderBy entries only accept 'asc' | 'desc'
    const invalidNestedOrder: TransferOrderBy = { senderAccount: { network: { description: 'up' } } }
  })

  test('orderBy of an embedded object field exposes its scalar fields', () => {
    expectTypeOf<NonNullable<AccountOrderBy['balance']>['EUR']>().toEqualTypeOf<'asc' | 'desc' | undefined>()
    const balanceOrder: AccountOrderBy = { balance: { EUR: 'desc' } }
  })
})
