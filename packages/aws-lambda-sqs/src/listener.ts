import { decodeAndValidate } from '@mondrian-framework/model'
import { Functions, Module, buildLogger, randomOperationId } from '@mondrian-framework/module'
import { isArray } from '@mondrian-framework/utils'
import { Context, SQSBatchItemFailure, SQSEvent, SQSHandler } from 'aws-lambda'

export type SqsFunctionSpecs = {
  malformedMessagePolicy?: 'ignore' | 'delete'
  reportBatchItemFailures?: boolean
} & (
  | {
      queueUrl: string
    }
  | { anyQueue: true }
)
export type SqsApi<F extends Functions> = {
  functions: {
    [K in keyof F]?: SqsFunctionSpecs | readonly SqsFunctionSpecs[]
  }
}
export function handler<const F extends Functions, CI>({
  module,
  api,
  context,
}: {
  module: Module<F, CI>
  api: SqsApi<F>
  context: (args: { event: SQSEvent; context: Context; recordIndex: number }) => Promise<CI>
}): SQSHandler {
  const specifications = Object.entries(api.functions).flatMap(([functionName, specifications]) => {
    if (!specifications) {
      return []
    }
    if (isArray(specifications)) {
      return specifications.map((specification) => [functionName, specification] as const)
    }
    return [[functionName, specifications] as const]
  })

  return async (event, fContext) => {
    const eventLog = buildLogger(module.name, fContext.awsRequestId, null, null, 'LAMBDA-SQS', new Date())
    eventLog(`Received ${event.Records.length} messages.`)
    const batchItemFailures: SQSBatchItemFailure[] = []
    let spec: SqsFunctionSpecs | undefined = undefined
    for (let i = 0; i < event.Records.length; i++) {
      const m = event.Records[i]
      const url = getQueueUrl(m.eventSourceARN)
      const [functionName, specification] =
        specifications.find(([_, s]) => 'anyQueue' in s || s.queueUrl === url) ?? ([null, null] as const)
      if (!specification || !functionName) {
        eventLog(`Message ${i} ignored! source: ${url}`, 'warn')
        continue
      }
      const functionBody = module.functions.definitions[functionName]
      spec = specification
      const operationId = randomOperationId()
      const log = buildLogger(module.name, operationId, url, functionName, 'LAMBDA-SQS', new Date())
      try {
        const contextInput = await context({ context: fContext, event, recordIndex: i })
        const ctx = await module.context(contextInput)
        let body: unknown
        try {
          body = m.body === undefined ? undefined : JSON.parse(m.body)
        } catch {
          log(`Bad message: not a valid json ${m.body}`)
          if (specification.malformedMessagePolicy === 'delete') {
            continue
          }
          if (!specification.reportBatchItemFailures) {
            throw new Error(`Bad message: not a valid json ${m.body}`)
          }
          batchItemFailures.push({ itemIdentifier: m.messageId })
        }
        const decoded = decodeAndValidate(functionBody.input, body, { inputUnion: true })
        if (!decoded.success) {
          log(`Bad message: ${JSON.stringify(decoded.errors)}`)
          if (specification.malformedMessagePolicy === 'delete') {
            continue
          }
          if (!specification.reportBatchItemFailures) {
            throw new Error(`Bad message: ${JSON.stringify(decoded.errors)}`)
          }
          batchItemFailures.push({ itemIdentifier: m.messageId })
          continue
        }
        await functionBody.apply({
          input: decoded.value,
          projection: undefined,
          operationId,
          context: ctx,
          log,
        })
        log(`Completed.`)
      } catch (error) {
        if (!specification.reportBatchItemFailures) {
          throw new Error(`Bad message: not a valid json ${m.body}`)
        }
        batchItemFailures.push({ itemIdentifier: m.messageId })
      }
    }
    if (spec?.reportBatchItemFailures) {
      return { batchItemFailures }
    }
  }
}

function getQueueUrl(queueArn: string): string {
  const parts = queueArn.split(':')
  const service = parts[2]
  const region = parts[3]
  const accountId = parts[4]
  const queueName = parts[5]
  return `https://${service}.${region}.amazonaws.com/${accountId}/${queueName}`
}
