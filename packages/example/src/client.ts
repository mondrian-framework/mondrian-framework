import { createRestSdk } from '@mondrian/rest'
import { REST_API } from './api'
import { module } from './module'

export async function sdkExample() {
  const sdk = createRestSdk({
    module,
    endpoint: 'http://127.0.0.1:4000',
    rest: REST_API,
    defaultHeaders: { id: '1234' },
  })
  for (let i = 0; i < 1; i++) {
    try {
      const ins = await sdk.register({
        input: {
          credentials: { email: 'asd@gmail.com', password: '12345' },
          profile: { firstname: `Mario ${i}`, lastname: 'Bros' },
          type: 'CUSTOMER',
        },
        fields: {
          ProfessionalUser: { id: true, profile: true, type: true },
          CustomerUser: { id: true, type: true },
        },
      })
      console.log(ins)
      const result = await sdk.users({
        input: {},
        fields: true,
      })
      console.log(result)
    } catch (error) {
      if (error instanceof Error) {
        console.log(error.message)
      }
    }
  }
}
