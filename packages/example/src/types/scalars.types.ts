import t from '@mondrian-framework/model'

export const Id = t.string().named('Id')
export type Id = t.Infer<typeof Id>
