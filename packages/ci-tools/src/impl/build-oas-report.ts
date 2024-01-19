import { RemoteSchema, moduleInterface } from '../interface'
import { contextProvider } from './providers'
import { writeReport } from './write-report'
import { result } from '@mondrian-framework/model'
import { execFileSync } from 'child_process'
import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'

export const buildOASReport = moduleInterface.functions.buildOASReport
  .withProviders({ context: contextProvider })
  .implement({
    async body({ input: { previousSchema, currentSchema, password }, context: { fileManager, serverBaseURL } }) {
      const binFile = path.join(
        path.dirname(require.resolve('@pb33f/openapi-changes/package.json')),
        '/bin/openapi-changes',
      )

      let previousSchemaContent
      if (typeof previousSchema === 'object' && 'url' in previousSchema) {
        const r = await fetchSchema(previousSchema)
        if (r.isFailure) {
          return result.fail({ badRequest: r.error })
        } else {
          previousSchemaContent = r.value
        }
      } else {
        previousSchemaContent = previousSchema
      }
      let currentSchemaContent
      if (typeof currentSchema === 'object' && 'url' in currentSchema) {
        const r = await fetchSchema(currentSchema)
        if (r.isFailure) {
          return result.fail({ badRequest: r.error })
        } else {
          currentSchemaContent = r.value
        }
      } else {
        currentSchemaContent = currentSchema
      }
      const s1FileName = `/tmp/${randomUUID()}.json`
      const s2FileName = `/tmp/${randomUUID()}.json`
      const reportId = randomUUID()
      const cwd = `/tmp/${reportId}`

      fs.mkdirSync(cwd)
      fs.writeFileSync(s1FileName, JSON.stringify(previousSchemaContent))
      fs.writeFileSync(s2FileName, JSON.stringify(currentSchemaContent))
      let report: any
      try {
        const execResult = execFileSync(binFile, ['report', s1FileName, s2FileName]).toString()
        report = JSON.parse(execResult)
        execFileSync(binFile, ['html-report', s1FileName, s2FileName], { cwd }).toString()
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
      const output = fs.readFileSync(`${cwd}/report.html`).toString()
      fs.unlinkSync(`${cwd}/report.html`)
      if (serverBaseURL) {
        await writeReport({ fileManager, content: output, password, reportId })
      }
      return result.ok({
        breakingChanges: report?.reportSummary?.components?.breakingChanges ?? 0,
        reportId: reportId,
        reportUrl: serverBaseURL ? new URL(`${serverBaseURL}/v1/reports/${reportId}`) : undefined,
        info: report,
      })
    },
  })

async function fetchSchema({ url, headers }: RemoteSchema): Promise<result.Result<unknown, string>> {
  const request = await fetch(url, { headers })
  if (request.status > 299 || request.status < 200) {
    return result.fail(`${url} returns ${request.status}`)
  }
  try {
    return result.ok(await request.json())
  } catch {
    return result.fail(`${url} body is not a JSON!`)
  }
}
