import { moduleInterface } from '../interface'
import { DEFAULT_PASSWORD, decrypt, sha256 } from '../utils'
import { contextProvider } from './providers'
import { result } from '@mondrian-framework/model'

export const getReport = moduleInterface.functions.getReport
  .with({ providers: { context: contextProvider } })
  .implement({
    async body({ input: { reportId, password }, context: { fileManager } }) {
      const secret = password || DEFAULT_PASSWORD
      const reportName = fileManager.type === 's3' ? `${reportId}.json` : `/tmp/${reportId}.json`
      const fileContent = await fileManager.read(reportName)
      if (!fileContent) {
        return result.fail({ reportNotFound: reportId })
      }
      const { secretHash, content } = JSON.parse(fileContent)
      if (sha256(secret) !== secretHash) {
        return result.fail({ reportNotFound: reportId })
      }
      const decrypted = decrypt(content, secret)
      return result.ok(decrypted ?? '')
    },
  })
