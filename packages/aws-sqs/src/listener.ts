import { Api, FunctionSpecifications } from './api'
import * as AWS from '@aws-sdk/client-sqs'
import { exception, functions, logger, module } from '@mondrian-framework/module'
import { sleep } from '@mondrian-framework/utils'

/**
 * Attaches a Mondrian module to some SQS queues.
 */
export function listen<Fs extends functions.FunctionImplementations>({
  api,
  context,
}: {
  api: Api<Fs>
  context: (args: { message: AWS.Message }) => Promise<module.FunctionsToContextInput<Fs>>
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
}

async function listenForMessage<Fs extends functions.FunctionImplementations>({
  alive,
  queueUrl,
  client,
  concurrency,
  ...input
}: ListenForMessageInput<Fs>) {
  let slots = concurrency
  while (alive.yes) {
    try {
      const message = await client.receiveMessage({ QueueUrl: queueUrl, MaxNumberOfMessages: 1, WaitTimeSeconds: 20 })
      slots++
      handleMessages({ ...input, messages: message.Messages, client, queueUrl })
        .then(() => {
          slots--
        })
        .catch(() => {
          slots--
        })
    } catch (error) {
      do {
        await sleep(1000)
      } while (slots <= 0)
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
  } catch {
    if (specifications.malformedMessagePolicy === 'delete') {
      await client.deleteMessage({ QueueUrl: queueUrl, ReceiptHandle: m.ReceiptHandle })
    }
    return
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
  } catch (e) {
    if (e instanceof exception.InvalidInput && specifications.malformedMessagePolicy === 'delete') {
      await client.deleteMessage({ QueueUrl: queueUrl, ReceiptHandle: m.ReceiptHandle })
    } else {
      throw e
    }
  }
  await client.deleteMessage({ QueueUrl: queueUrl, ReceiptHandle: m.ReceiptHandle })
}
