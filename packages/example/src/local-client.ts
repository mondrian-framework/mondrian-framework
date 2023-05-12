import { createLocalSdk } from '@mondrian/module'
import { module } from './module'

export async function localSdkExample(db: Map<string, any>) {
  const sdk = createLocalSdk({
    module,
    async context() {
      return { startingId: 1, db }
    },
  })
  for (let i = 0; i < 1; i++) {
    try {
      const ins = await sdk.register({
        input: {
          credentials: { email: 'asd@gmail.com', password: '12345' },
          profile: { firstname: `Luigi ${i}`, lastname: 'Bros' },
          type: 'CUSTOMER',
        },
        fields: {
          ProfessionalUser: { id: true, profile: true, type: true },
          CustomerUser: { id: true, type: true },
        },
      })
      //console.log(ins)
      const result = await sdk.users({
        input: {},
        fields: true,
      })
      //console.log(result)
    } catch (error) {
      if (error instanceof Error) {
        console.log(error.message)
      }
    }
  }
}
