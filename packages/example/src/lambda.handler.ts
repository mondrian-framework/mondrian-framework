import { module } from './module'
import { handler } from '@mondrian-framework/aws-lambda-sqs'

export default handler({
  module,
  api: { functions: { register: { anyQueue: true } } },
  context: async ({}) => {
    return { jwt: undefined }
  },
})
