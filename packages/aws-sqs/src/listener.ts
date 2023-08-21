import * as AWS from '@aws-sdk/client-sqs'
import { decoder } from '@mondrian-framework/model'
import { functions, logger, module, utils } from '@mondrian-framework/module'
import { sleep } from '@mondrian-framework/utils'

export type SqsFunctionSpecs = {
  queueUrl: string
  malformedMessagePolicy?: 'ignore' | 'delete'
  maxConcurrency?: number
}

export type SqsApi<Fs extends functions.Functions> = {
  functions: {
    [K in keyof Fs]?: SqsFunctionSpecs
  }
  options?: {
    config?: AWS.SQSClientConfig
    maxConcurrency?: number
  }
}

export function start<const Fs extends functions.Functions, const CI>({
  module,
  api,
  context,
}: {
  module: module.Module<Fs, CI>
  api: SqsApi<Fs>
  context: (args: { message: AWS.Message }) => Promise<CI>
}): { close: () => Promise<void> } {
  const client: AWS.SQS = new AWS.SQS(api.options?.config ?? {})

  const promises: Promise<void>[] = []
  const alive: { yes: boolean } = { yes: true }
  for (const functionName of Object.keys(module.functions.definitions)) {
    const specifications = api.functions[functionName]
    if (!specifications) {
      continue
    }
    const concurrency = specifications.maxConcurrency ?? api.options?.maxConcurrency ?? 1
    if (!Number.isInteger(concurrency) || concurrency <= 0) {
      throw new Error('Concurrency must be a positive integer')
    }
    const p = listenForMessage({
      queueUrl: specifications.queueUrl,
      alive,
      client,
      module,
      functionName,
      context,
      specifications,
      concurrency,
    })
    promises.push(p)
  }

  return {
    async close() {
      alive.yes = false
      await logger.build({ moduleName: module.name, server: 'SQS' })('Closing listeners...')
      await Promise.all(promises)
    },
  }
}

async function listenForMessage<const Fs extends functions.Functions, const CI>({
  alive,
  queueUrl,
  client,
  module,
  functionName,
  context,
  specifications,
  concurrency,
}: {
  queueUrl: string
  alive: { yes: boolean }
  client: AWS.SQS
  module: module.Module<Fs, CI>
  functionName: string
  context: (args: { message: AWS.Message }) => Promise<CI>
  specifications: SqsFunctionSpecs
  concurrency: number
}) {
  const functionBody = module.functions[functionName]
  const baseLogger = logger.withContext({
    moduleName: module.name,
    operationType: queueUrl,
    operationName: functionName,
    server: 'SQS',
  })
  const listenerLog = baseLogger.build()
  await listenerLog('Started.')
  while (alive.yes) {
    try {
      const message = await client.receiveMessage({ QueueUrl: queueUrl, MaxNumberOfMessages: 1, WaitTimeSeconds: 20 })
      if (!message.Messages || message.Messages.length !== 1) {
        continue
      }
      //TODO: execute in a separate handler (concurrency)
      const operationId = utils.randomOperationId()
      const m = message.Messages[0]
      const log = baseLogger.build({ operationId })
      let body: unknown
      try {
        body = m.Body === undefined ? undefined : JSON.parse(m.Body)
      } catch {
        if (specifications.malformedMessagePolicy === 'delete') {
          await client.deleteMessage({ QueueUrl: queueUrl, ReceiptHandle: m.ReceiptHandle })
        }
        await log(`Bad message: not a valid json ${m.Body}`)
        continue
      }
      const decoded = decoder.decode(functionBody.input, body, { typeCastingStrategy: 'expectExactTypes' })
      if (!decoded.isOk) {
        if (specifications.malformedMessagePolicy === 'delete') {
          await client.deleteMessage({ QueueUrl: queueUrl, ReceiptHandle: m.ReceiptHandle })
        }
        await log(`Bad message: ${JSON.stringify(decoded.error)}`)
        continue
      }
      const contextInput = await context({ message: m })
      const ctx = await module.context(contextInput, {
        input: decoded.value,
        projection: undefined,
        operationId,
        log,
      })
      await functions.apply(functionBody, {
        input: decoded.value,
        projection: undefined,
        operationId,
        context: ctx,
        log,
      })
      await client.deleteMessage({ QueueUrl: queueUrl, ReceiptHandle: m.ReceiptHandle })
      await log(`Completed.`)
    } catch (error) {
      if (error instanceof Error) {
        listenerLog(error.message, 'error')
      }
      await sleep(1000)
    }
  }
  listenerLog('Stopped.')
}
