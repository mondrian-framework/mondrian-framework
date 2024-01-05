import { FileManager } from '../file-manager'
import { DEFAULT_PASSWORD, encrypt, sha256 } from '../utils'

export async function writeReport({
  fileManager,
  password,
  content,
  reportId,
}: {
  fileManager: FileManager
  password: string | undefined
  content: string
  reportId: string
}): Promise<void> {
  const secret = password || DEFAULT_PASSWORD
  const secretHash = sha256(secret)
  const encrypted = encrypt(content, secret)
  const toWrite = JSON.stringify({ secretHash, content: encrypted })
  await fileManager.write(fileManager.type === 's3' ? `${reportId}.json` : `/tmp/${reportId}.json`, toWrite)
}
