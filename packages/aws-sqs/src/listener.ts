import { Api, FunctionSpecifications } from './api'
import * as AWS from '@aws-sdk/client-sqs'
import { model } from '@mondrian-framework/model'
import { functions, logger, module, utils } from '@mondrian-framework/module'
import { sleep } from '@mondrian-framework/utils'

/**
 * TODO: doc
 */
export function listen<Fs extends functions.Functions, E extends functions.ErrorType, CI>({
  api,
  context,
}: {
  api: Api<Fs, E, CI>
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

async function listenForMessage<Fs extends functions.Functions, E extends functions.ErrorType, CI>({
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
  module: module.Module<Fs, E, CI>
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
  while (alive.yes) {
    try {
      const message = await client.receiveMessage({ QueueUrl: queueUrl, MaxNumberOfMessages: 1, WaitTimeSeconds: 20 })
      if (!message.Messages || message.Messages.length !== 1) {
        continue
      }
      //TODO [Good first issue]: execute in a separate handler (concurrency)
      const m = message.Messages[0]
      let body: unknown
      try {
        body = m.Body === undefined ? undefined : JSON.parse(m.Body)
      } catch {
        if (specifications.malformedMessagePolicy === 'delete') {
          await client.deleteMessage({ QueueUrl: queueUrl, ReceiptHandle: m.ReceiptHandle })
        }
        continue
      }
      const decoded = model.concretise(functionBody.input).decode(body, { typeCastingStrategy: 'expectExactTypes' })
      if (decoded.isFailure) {
        if (specifications.malformedMessagePolicy === 'delete') {
          await client.deleteMessage({ QueueUrl: queueUrl, ReceiptHandle: m.ReceiptHandle })
        }
        continue
      }
      const contextInput = await context({ message: m })
      const ctx = await module.context(contextInput, {
        input: decoded.value,
        retrieve: undefined,
        tracer: functionBody.tracer,
        logger: baseLogger,
        functionName,
      })
      await functionBody.apply({
        input: decoded.value as never,
        retrieve: {},
        tracer: functionBody.tracer,
        context: ctx,
        logger: baseLogger,
      })
      await client.deleteMessage({ QueueUrl: queueUrl, ReceiptHandle: m.ReceiptHandle })
    } catch (error) {
      await sleep(1000)
    }
  }
}
