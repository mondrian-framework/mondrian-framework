import { LOCAL_FILE_MANAGER, S3_FILE_MANAGER } from '../file-manager'
import { result } from '@mondrian-framework/model'
import { provider } from '@mondrian-framework/module'

export const contextProvider = provider.build({
  body: async () =>
    result.ok({
      serverBaseURL: process.env.SERVER_BASE_URL,
      fileManager: process.env.BUCKET ? S3_FILE_MANAGER : LOCAL_FILE_MANAGER,
    }),
})
