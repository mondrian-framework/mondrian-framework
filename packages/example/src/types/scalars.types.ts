import t from '@mondrian-framework/model'

export const Id = t.integer({ minimum: 0 })
export type Id = t.Infer<typeof Id>
