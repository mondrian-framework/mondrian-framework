import { Api, FunctionSpecifications } from './api'
import * as AWS from '@aws-sdk/client-sqs'
import { model } from '@mondrian-framework/model'
import { functions, logger, module, utils } from '@mondrian-framework/module'
import { sleep } from '@mondrian-framework/utils'

/**
 * TODO: doc
 */
export function listen<const Fs extends functions.Functions, const CI>({
  api,
  context,
}: {
  api: Api<Fs, CI>
  context: (args: { message: AWS.Message }) => Promise<CI>
}): { close: () => Promise<void> } {
  const client: AWS.SQS = new AWS.SQS(api.options?.config ?? {})
  const promises: Promise<void>[] = []
  const alive: { yes: boolean } = { yes: true }
  for (const functionName of Object.keys(api.module.functions.definitions)) {
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
      module: api.module,
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
      logger.build({ moduleName: api.module.name, server: 'SQS' }).logInfo('Closing listeners...')
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
  specifications: FunctionSpecifications
  concurrency: number
}) {
  const functionBody = module.functions[functionName]
  const baseLogger = logger.build({
    moduleName: module.name,
    operationType: queueUrl,
    operationName: functionName,
    server: 'SQS',
  })
  baseLogger.logInfo('Started.')
  while (alive.yes) {
    try {
      const message = await client.receiveMessage({ QueueUrl: queueUrl, MaxNumberOfMessages: 1, WaitTimeSeconds: 20 })
      if (!message.Messages || message.Messages.length !== 1) {
        continue
      }
      //TODO [Good first issue]: execute in a separate handler (concurrency)
      const operationId = utils.randomOperationId()
      const m = message.Messages[0]
      const operationLogger = baseLogger.updateContext({ operationId })
      let body: unknown
      try {
        body = m.Body === undefined ? undefined : JSON.parse(m.Body)
      } catch {
        if (specifications.malformedMessagePolicy === 'delete') {
          await client.deleteMessage({ QueueUrl: queueUrl, ReceiptHandle: m.ReceiptHandle })
        }
        operationLogger.logError(`Bad message: not a valid json ${m.Body}`)
        continue
      }
      const decoded = model.concretise(functionBody.input).decode(body, { typeCastingStrategy: 'expectExactTypes' })
      if (!decoded.isOk) {
        if (specifications.malformedMessagePolicy === 'delete') {
          await client.deleteMessage({ QueueUrl: queueUrl, ReceiptHandle: m.ReceiptHandle })
        }
        operationLogger.logError(`Bad message: ${JSON.stringify(decoded.error)}`)
        continue
      }
      const contextInput = await context({ message: m })
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
      await client.deleteMessage({ QueueUrl: queueUrl, ReceiptHandle: m.ReceiptHandle })
      operationLogger.logInfo(`Completed.`)
    } catch (error) {
      if (error instanceof Error) {
        baseLogger.logError(error.message)
      }
      await sleep(1000)
    }
  }
  baseLogger.logInfo('Stopped.')
}
