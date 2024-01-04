import * as AWS from '@aws-sdk/client-s3'
import fs from 'fs'

export interface FileManager {
  type: 'local' | 's3'
  read(filename: string): Promise<string | null>
  write(filename: string, content: string): Promise<void>
}

export const LOCAL_FILE_MANAGER: FileManager = {
  type: 'local',
  async read(filename) {
    try {
      return fs.readFileSync(filename).toString()
    } catch {
      return null
    }
  },
  async write(filename, content) {
    fs.writeFileSync(filename, content)
  },
}

export const S3_FILE_MANAGER: FileManager = {
  type: 's3',
  async read(filename) {
    try {
      const client = new AWS.S3({ region: process.env.REGION ?? 'eu-central-1' })
      const response = await client.getObject({
        Bucket: process.env.BUCKET,
        Key: filename,
      })
      return (await response.Body?.transformToString('utf-8')) ?? null
    } catch {
      return null
    }
  },
  async write(filename, content) {
    const client = new AWS.S3({ region: process.env.REGION ?? 'eu-central-1' })
    await client.putObject({
      Bucket: process.env.BUCKET,
      Key: filename,
      Body: content,
    })
  },
}
