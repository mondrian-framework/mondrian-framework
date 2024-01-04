import { moduleInterface } from '../interface'
import { DEFAULT_PASSWORD, encrypt, sha256 } from '../utils'
import { Context } from './module'
import { result } from '@mondrian-framework/model'
import { execFileSync } from 'child_process'
import { randomUUID } from 'crypto'
import fs from 'fs'

export const buildOASReport = moduleInterface.functions.buildOASReport.implement<Context>({
  async body({ input: { previousSchema, currentSchema, password }, context: { fileManager, serverBaseURL } }) {
    const binFile = process.env.PB33F_FILENAME
    if (!binFile) {
      return result.fail({ pb33fNotDefined: 'PB33F_FILENAME missing' })
    }

    let previousSchemaContent
    if (previousSchema instanceof URL) {
      const request = await fetch(previousSchema)
      if (request.status > 299 || request.status < 200) {
        return result.fail({ badRequest: `Downloading of previous schema returns ${request.status}` })
      }
      try {
        previousSchemaContent = await request.json()
      } catch {
        return result.fail({ badRequest: `Previous schema is not a JSON!` })
      }
    } else {
      previousSchemaContent = previousSchema
    }
    let currentSchemaContent
    if (currentSchema instanceof URL) {
      const request = await fetch(currentSchema)
      if (request.status > 299 || request.status < 200) {
        return result.fail({ badRequest: `Downloading of current schema returns ${request.status}` })
      }
      try {
        currentSchemaContent = await request.json()
      } catch {
        return result.fail({ badRequest: `Current schema is not a JSON!` })
      }
    } else {
      currentSchemaContent = currentSchema
    }
    const s1FileName = `/tmp/${randomUUID()}.json`
    const s2FileName = `/tmp/${randomUUID()}.json`
    const reportId = randomUUID()
    const reportName = fileManager.type === 's3' ? `${reportId}.json` : `/tmp/${reportId}.json`
    const cwd = `/tmp/${reportId}`
    const secret = password || DEFAULT_PASSWORD
    const secretHash = sha256(secret)
    try {
      fs.writeFileSync(s1FileName, JSON.stringify(previousSchemaContent))
      fs.writeFileSync(s2FileName, JSON.stringify(currentSchemaContent))
      const execResult = execFileSync(binFile, ['report', s1FileName, s2FileName]).toString()
      const report = JSON.parse(execResult)
      fs.mkdirSync(cwd)
      execFileSync(binFile, ['html-report', s1FileName, s2FileName], { cwd }).toString()
      const output = fs.readFileSync(`${cwd}/report.html`).toString()
      fs.unlinkSync(`${cwd}/report.html`)
      const content = JSON.stringify({ secretHash, content: encrypt(output, secret) })
      await fileManager.write(reportName, content)
      return result.ok({
        breakingChanges: report?.reportSummary?.components?.breakingChanges ?? 0,
        reportId: reportId,
        reportUrl: new URL(`${serverBaseURL}/v1/reports/${reportId}`),
      })
    } catch (e) {
      if (e instanceof Error) {
        return result.fail({ badRequest: `Unable to parse specifications. ${e.message}` })
      } else {
        return result.fail({ badRequest: 'Unknown error' })
      }
    } finally {
      fs.unlinkSync(s1FileName)
      fs.unlinkSync(s2FileName)
    }
  },
})
