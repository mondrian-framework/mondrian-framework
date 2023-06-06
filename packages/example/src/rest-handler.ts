import { REST_API } from './api'
import { module } from './module'
import { handler } from '@mondrian-framework/aws-lambda-rest'

export default handler({
  module,
  api: REST_API,
  context: async ({ lambdaApi }) => {
    return { jwt: lambdaApi.request.headers.authorization }
  },
})
