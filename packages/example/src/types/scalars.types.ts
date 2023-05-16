import t from '@mondrian/model'

export const Id = t.custom(
  {
    name: 'ID',
    decode(input) {
      if (typeof input !== 'string') {
        return { pass: false, errors: [{ value: input, error: 'ID expected' }] }
      }
      if (input.length === 0) {
        return { pass: false, errors: [{ value: input, error: 'Empty ID is not valid' }] }
      }
      return { pass: true, value: input }
    },
    encode(input) {
      return input
    },
    is(input) {
      return typeof input === 'string' && input.length > 0
    },
  },
  {
    description: 'A 12 byte ID, hex format',
  },
)
export type Id = t.Infer<typeof Id>
