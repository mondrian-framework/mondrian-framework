import { RemoteSchema, moduleInterface } from '../interface'
import { Context } from './module'
import { writeReport } from './write-report'
import { diff } from '@graphql-inspector/core'
import { CriticalityLevel } from '@graphql-inspector/core'
import { result } from '@mondrian-framework/model'
import { randomUUID } from 'crypto'
import { GraphQLSchema, getIntrospectionQuery, buildClientSchema } from 'graphql'

export const buildGraphQLReport = moduleInterface.functions.buildGraphQLReport.implement<Context>({
  async body({ input: { previousSchema, currentSchema, password }, context: { fileManager, serverBaseURL } }) {
    const pSchema = await parseSchema(previousSchema)
    if (pSchema.isFailure) {
      return pSchema
    }
    const cSchema = await parseSchema(currentSchema)
    if (cSchema.isFailure) {
      return cSchema
    }
    const reportId = randomUUID()
    const changes = await diff(pSchema.value, cSchema.value)
    const html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
      </head>
      <body>
        <pre id="json-data"></pre>
        <script type="text/javascript">
          const data = ${JSON.stringify(changes)};
          const preElement = document.getElementById('json-data');
          preElement.innerHTML = JSON.stringify(data, null, 2);
        </script>
      </body>
    </html>
    `
    await writeReport({ fileManager, content: html, password, reportId })
    return result.ok({
      breakingChanges: changes.filter((c) => c.criticality.level === CriticalityLevel.Breaking).length,
      reportId,
      reportUrl: new URL(`${serverBaseURL}/v1/reports/${reportId}`),
      info: changes
    })
  },
})

async function parseSchema(
  source: GraphQLSchema | RemoteSchema,
): Promise<result.Result<GraphQLSchema, { badRequest: string }>> {
  if (source instanceof GraphQLSchema) {
    return result.ok(source)
  } else {
    return downloadSchema(source)
  }
}

async function downloadSchema(source: RemoteSchema): Promise<result.Result<GraphQLSchema, { badRequest: string }>> {
  try {
    const data = await fetch(source.url, {
      method: 'POST',
      headers: {
        ...source.headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: getIntrospectionQuery(),
      }),
    })
    if (data.status < 200 || data.status > 299) {
      return result.fail({ badRequest: `Cannot download schema from ${source.url}. ${data.status}` })
    }
    const json = await data.json()
    const schema = buildClientSchema(json.data)
    return result.ok(schema)
  } catch (error) {
    return result.fail({
      badRequest:
        error instanceof Error
          ? `Cannot download schema from ${source.url}. ${error.message}`
          : 'Cannot download schema',
    })
  }
}
