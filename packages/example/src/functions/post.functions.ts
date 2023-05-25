import f from './functions.commons'

export const checkPost = f({
  input: 'Void',
  output: 'CheckPostOutput',
  async apply({ input, context, projection, operationId }) {
    return { blockedPosts: [], passedPosts: [] }
  },
})
