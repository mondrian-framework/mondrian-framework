import t from '@mondrian/model'

export const Id = t.number({ minimum: 0 }) //TODO: Integer
export type Id = t.Infer<typeof Id>

export const JWT = t.string({ regex: new RegExp('.*') })
export type JWT = t.Infer<typeof JWT>
