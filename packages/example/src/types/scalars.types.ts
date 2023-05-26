import t from '@mondrian-framework/model'

export const Id = t.integer({ minimum: 0 })
export type Id = t.Infer<typeof Id>

export const JWT = t.string({ regex: /^(?:[\w-]*\.){2}[\w-]*$/ })
export type JWT = t.Infer<typeof JWT>
