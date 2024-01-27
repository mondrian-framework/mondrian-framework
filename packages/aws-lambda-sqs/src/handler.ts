import { model } from '@mondrian-framework/model'
import { functions, logger, module } from '@mondrian-framework/module'
import { isArray } from '@mondrian-framework/utils'
import { SpanKind, SpanStatusCode } from '@opentelemetry/api'
import { Context, SQSBatchItemFailure, SQSEvent, SQSHandler } from 'aws-lambda'

export type Api<Fs extends functions.Functions> = {
  functions: {
    [K in keyof Fs]?: FunctionSpecifications | readonly FunctionSpecifications[]
  }
}

//TODO: API build & define

type FunctionSpecifications = {
  malformedMessagePolicy?: 'ignore' | 'delete'
  reportBatchItemFailures?: boolean
} & (
  | {
      queueUrl: string
    }
  | { anyQueue: true }
)

export function build<Fs extends functions.FunctionImplementations>({
  module,
  api,
  context,
}: {
  module: module.Module<Fs>
  api: Api<Fs>
  context: (args: {
    event: SQSEvent
    context: Context
    recordIndex: number
  }) => Promise<module.FunctionsToContextInput<Fs>>
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
    const batchItemFailures: SQSBatchItemFailure[] = []
    let spec: FunctionSpecifications | undefined = undefined
    for (let i = 0; i < event.Records.length; i++) {
      const m = event.Records[i]
      const url = getQueueUrl(m.eventSourceARN)
      const [functionName, specification] =
        specifications.find(([_, s]) => 'anyQueue' in s || s.queueUrl === url) ?? ([null, null] as const)
      if (!specification || !functionName) {
        continue
      }
      spec = specification
      const functionBody = module.functions[functionName]
      const tracer = functionBody.tracer.withPrefix(`mondrian:sqs-handler:${functionName}:`)
      await functionBody.tracer.startActiveSpanWithOptions(
        `mondrian:sqs-handler:${functionName}`,
        {
          kind: SpanKind.INTERNAL,
        },
        async (span) => {
          const operationLogger = baseLogger.updateContext({
            operationType: url,
            operationName: functionName,
          })
          try {
            let body: unknown
            try {
              body = m.body === undefined ? undefined : JSON.parse(m.body)
            } catch {
              const message = `Bad message: not a valid json ${m.body}`
              if (specification.malformedMessagePolicy === 'delete') {
                span?.setStatus({ code: SpanStatusCode.ERROR, message })
                span?.end()
                return
              }
              if (!specification.reportBatchItemFailures) {
                throw new Error(message)
              }
              batchItemFailures.push({ itemIdentifier: m.messageId })
            }

            const decoded = model
              .concretise(functionBody.input)
              .decode(body, { typeCastingStrategy: 'expectExactTypes' })
            if (decoded.isFailure) {
              const message = `Bad message: ${JSON.stringify(decoded.error)}`
              if (specification.malformedMessagePolicy === 'delete') {
                span?.setStatus({ code: SpanStatusCode.ERROR, message })
                span?.end()
                return
              }
              if (!specification.reportBatchItemFailures) {
                throw new Error(message)
              }
              batchItemFailures.push({ itemIdentifier: m.messageId })
              return
            }
            const contextInput = await context({ context: fContext, event, recordIndex: i })
            await functionBody.apply({
              input: decoded.value as never,
              retrieve: {},
              tracer,
              contextInput: contextInput as Record<string, unknown>,
              logger: operationLogger,
            })
            span?.end()
          } catch (error) {
            if (error instanceof Error) {
              span?.recordException(error)
            }
            span?.setStatus({ code: SpanStatusCode.ERROR })
            span?.end()
            if (!specification.reportBatchItemFailures) {
              throw new Error(`Bad message: not a valid json ${m.body}`)
            }
            batchItemFailures.push({ itemIdentifier: m.messageId })
          }
        },
      )
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
