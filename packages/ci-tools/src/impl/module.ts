import { FileManager, LOCAL_FILE_MANAGER, S3_FILE_MANAGER } from '../file-manager'
import { moduleInterface } from '../interface'
import { buildGraphQLReport } from './build-graphql-report'
import { buildOASReport } from './build-oas-report'
import { getReport } from './get-report'
import { result } from '@mondrian-framework/model'

export type Context = {
  readonly fileManager: FileManager
  readonly serverBaseURL?: string
}

export const module = moduleInterface.implement({
  context: async () =>
    result.ok({
      fileManager: process.env.BUCKET ? S3_FILE_MANAGER : LOCAL_FILE_MANAGER,
      serverBaseURL: process.env.SERVER_BASE_URL,
    }),
  functions: { getReport, buildOASReport, buildGraphQLReport },
  options: { checkOutputType: 'throw' },
})
