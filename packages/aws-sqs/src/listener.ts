import { Api, FunctionSpecifications } from './api'
import * as AWS from '@aws-sdk/client-sqs'
import { exception, functions, logger, module } from '@mondrian-framework/module'
import { sleep } from '@mondrian-framework/utils'

type ErrorHandler<F extends functions.Functions> = (args: {
  errorKind: 'invalid-input' | 'function-apply'
  error: unknown
  logger: logger.MondrianLogger
  functionName: keyof F
  tracer: functions.Tracer
  sqs: { messageId: string | undefined; url: string; message: string }
}) =>
  | Promise<{ action: 'do-not-delete-message' | 'delete-message' } | void>
  | { action: 'do-not-delete-message' | 'delete-message' }
  | void

/**
 * Attaches a Mondrian module to some SQS queues.
 */
export function listen<Fs extends functions.FunctionImplementations>({
  api,
  context,
  onError,
}: {
  api: Api<Fs>
  context: (args: { message: AWS.Message }) => Promise<module.FunctionsToContextInput<Fs>>
  onError: ErrorHandler<Fs>
}): { close: () => Promise<void> } {
  const client: AWS.SQS = new AWS.SQS(api.options?.config ?? {})
  const promises: Promise<void>[] = []
  const alive: { yes: boolean } = { yes: true }
  for (const functionName of Object.keys(api.module.functions)) {
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
      onError,
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

type ListenForMessageInput<Fs extends functions.FunctionImplementations> = {
  queueUrl: string
  alive: { yes: boolean }
  client: AWS.SQS
  module: module.Module<Fs>
  functionName: string
  context: (args: { message: AWS.Message }) => Promise<module.FunctionsToContextInput<Fs>>
  specifications: FunctionSpecifications
  concurrency: number
  onError: ErrorHandler<Fs>
}

async function listenForMessage<Fs extends functions.FunctionImplementations>({
  alive,
  queueUrl,
  client,
  concurrency,
  ...input
}: ListenForMessageInput<Fs>) {
  let inFlight = 0
  while (alive.yes) {
    //Wait while at concurrency limit; release happens in the .finally below.
    while (alive.yes && inFlight >= concurrency) {
      await sleep(50)
    }
    if (!alive.yes) {
      break
    }
    try {
      const message = await client.receiveMessage({ QueueUrl: queueUrl, MaxNumberOfMessages: 1, WaitTimeSeconds: 20 })
      inFlight++
      handleMessages({ ...input, messages: message.Messages, client, queueUrl })
        .catch(() => {})
        .finally(() => {
          inFlight--
        })
    } catch (error) {
      await sleep(1000)
    }
  }
}

async function handleMessages<Fs extends functions.FunctionImplementations>({
  queueUrl,
  client,
  module,
  context,
  specifications,
  functionName,
  messages,
  onError,
}: Omit<ListenForMessageInput<Fs>, 'alive' | 'concurrency'> & { messages: AWS.Message[] | undefined }) {
  const baseLogger = logger.build({
    moduleName: module.name,
    operationType: queueUrl,
    operationName: functionName,
    server: 'SQS',
  })
  const functionBody = module.functions[functionName]
  if (!messages || messages.length !== 1) {
    return
  }
  const m = messages[0]
  let body: unknown
  try {
    body = m.Body === undefined ? undefined : JSON.parse(m.Body)
  } catch (error) {
    const onErrorResult = await onError({
      errorKind: 'invalid-input',
      error,
      logger: baseLogger,
      functionName,
      tracer: functionBody.tracer,
      sqs: { messageId: m.MessageId, url: queueUrl, message: m.Body ?? '' },
    })
    if (typeof onErrorResult === 'object' && onErrorResult.action === 'do-not-delete-message') {
      throw error
    } else {
      await client.deleteMessage({ QueueUrl: queueUrl, ReceiptHandle: m.ReceiptHandle })
      return
    }
  }
  const contextInput = await context({ message: m })
  try {
    await functionBody.rawApply({
      rawInput: body,
      rawRetrieve: {},
      //tracer: functionBody.tracer, //TODO: add opentelemetry istrumentation
      contextInput: contextInput as Record<string, unknown>,
      logger: baseLogger,
      decodingOptions: { typeCastingStrategy: 'tryCasting', ...module.options?.preferredDecodingOptions },
    })
  } catch (error) {
    const onErrorResult = await onError({
      errorKind: error instanceof exception.InvalidInput ? 'invalid-input' : 'function-apply',
      error,
      logger: baseLogger,
      functionName,
      tracer: functionBody.tracer,
      sqs: { messageId: m.MessageId, url: queueUrl, message: m.Body ?? '' },
    })
    if (typeof onErrorResult === 'object' && onErrorResult.action === 'do-not-delete-message') {
      throw error
    }
  }
  await client.deleteMessage({ QueueUrl: queueUrl, ReceiptHandle: m.ReceiptHandle })
}
