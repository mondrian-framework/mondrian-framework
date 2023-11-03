import { decoding, types } from '@mondrian-framework/model'
import { functions, logger, module, utils } from '@mondrian-framework/module'
import { isArray } from '@mondrian-framework/utils'
import { Context, SQSBatchItemFailure, SQSEvent, SQSHandler } from 'aws-lambda'

/**
 * TODO: doc
 */
export type Api<Fs extends functions.Functions> = {
  functions: {
    [K in keyof Fs]?: FunctionSpecifications | readonly FunctionSpecifications[]
  }
}

type FunctionSpecifications = {
  malformedMessagePolicy?: 'ignore' | 'delete'
  reportBatchItemFailures?: boolean
} & (
  | {
      queueUrl: string
    }
  | { anyQueue: true }
)

/**
 * TODO: doc
 */
export function build<const Fs extends functions.Functions, CI>({
  module,
  api,
  context,
}: {
  module: module.Module<Fs, CI>
  api: Api<Fs>
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
    const baseLogger = logger.build({ moduleName: module.name, server: 'LAMBDA-SQS' })
    baseLogger.logInfo(`Received ${event.Records.length} messages.`)
    const batchItemFailures: SQSBatchItemFailure[] = []
    let spec: FunctionSpecifications | undefined = undefined
    for (let i = 0; i < event.Records.length; i++) {
      const m = event.Records[i]
      const url = getQueueUrl(m.eventSourceARN)
      const [functionName, specification] =
        specifications.find(([_, s]) => 'anyQueue' in s || s.queueUrl === url) ?? ([null, null] as const)
      if (!specification || !functionName) {
        baseLogger.logWarn(`Message ${i} ignored! source: ${url}`)
        continue
      }
      const functionBody = module.functions[functionName]
      spec = specification
      const operationId = utils.randomOperationId()
      const operationLogger = baseLogger.updateContext({ operationId, operationType: url, operationName: functionName })
      try {
        let body: unknown
        try {
          body = m.body === undefined ? undefined : JSON.parse(m.body)
        } catch {
          operationLogger.logError(`Bad message: not a valid json ${m.body}`)
          if (specification.malformedMessagePolicy === 'delete') {
            continue
          }
          if (!specification.reportBatchItemFailures) {
            throw new Error(`Bad message: not a valid json ${m.body}`)
          }
          batchItemFailures.push({ itemIdentifier: m.messageId })
        }

        const decoded = types.concretise(functionBody.input).decode(body, { typeCastingStrategy: 'expectExactTypes' })
        if (!decoded.isOk) {
          operationLogger.logError(`Bad message: ${JSON.stringify(decoded.error)}`)
          if (specification.malformedMessagePolicy === 'delete') {
            continue
          }
          if (!specification.reportBatchItemFailures) {
            throw new Error(`Bad message: ${JSON.stringify(decoded.error)}`)
          }
          batchItemFailures.push({ itemIdentifier: m.messageId })
          continue
        }
        const contextInput = await context({ context: fContext, event, recordIndex: i })
        const ctx = await module.context(contextInput, {
          input: decoded.value,
          retrieve: undefined,
          operationId,
          logger: operationLogger,
        })
        await functionBody.apply({
          input: decoded.value as never,
          retrieve: {},
          operationId,
          context: ctx,
          logger: operationLogger,
        })
        operationLogger.logInfo(`Completed.`)
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
