import { Api } from './api'
import { functions } from '@mondrian-framework/module'
import { IncomingMessage, OutgoingMessage } from 'http'

export function handler<Fs extends functions.FunctionImplementations, ServerContext>({
  api,
}: {
  api: Api<Fs>
}): (request: IncomingMessage, response: OutgoingMessage) => Promise<void> {
  return async (request, response) => {
    //load body
    const body = await new Promise<string>((resolve, reject) => {
      let body = ''
      request.on('data', (chunk) => {
        body += chunk
      })
    })
  }
}
