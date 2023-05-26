import { Types, decode } from '@mondrian-framework/model'
import {
  ContextType,
  Functions,
  GenericModule,
  Module,
  buildLogger,
  randomOperationId,
} from '@mondrian-framework/module'
import * as AWS from '@aws-sdk/client-sqs'
import { sleep } from '@mondrian-framework/utils'

export type SqsFunctionSpecs = { inputQueueUrl: string; malformedMessagePolicy?: 'ignore' | 'delete' }
export type ModuleSqsApi<F extends Functions> = {
  functions: {
    [K in keyof F]?: SqsFunctionSpecs
  }
  options?: {
    config?: AWS.SQSClientConfig
  }
}

export function listen<
  const T extends Types,
  const F extends Functions<keyof T extends string ? keyof T : string>,
  CI,
>({
  module,
  api,
  context,
}: {
  module: Module<T, F, CI>
  api: ModuleSqsApi<F>
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
    const p = listenForMessage({
      queueUrl: specifications.inputQueueUrl,
      alive,
      client,
      module,
      functionName,
      context,
      specifications,
    })
    promises.push(p)
  }

  return {
    async close() {
      alive.yes = false
      buildLogger(module.name, null, null, null, 'SQS', new Date())('Closing listeners...')
      await Promise.all(promises)
    },
  }
}

async function listenForMessage({
  alive,
  queueUrl,
  client,
  module,
  functionName,
  context,
  specifications,
}: {
  queueUrl: string
  alive: { yes: boolean }
  client: AWS.SQS
  module: GenericModule
  functionName: string
  context: (args: { message: AWS.Message }) => Promise<unknown>
  specifications: SqsFunctionSpecs
}) {
  const functionBody = module.functions.definitions[functionName]
  const inputType = module.types[functionBody.input]
  const listenerLog = buildLogger(module.name, null, queueUrl, functionName, 'SQS', new Date())
  listenerLog('Started.')
  while (alive.yes) {
    const operationId = randomOperationId()
    try {
      const message = await client.receiveMessage({ QueueUrl: queueUrl, MaxNumberOfMessages: 1, WaitTimeSeconds: 20 })
      if (!message.Messages || message.Messages.length !== 1) {
        continue
      }
      const m = message.Messages[0]
      const log = buildLogger(module.name, operationId, queueUrl, functionName, 'SQS', new Date())
      let body: unknown
      try {
        body = m.Body === undefined ? undefined : JSON.parse(m.Body)
      } catch {
        if (specifications.malformedMessagePolicy === 'delete') {
          await client.deleteMessage({ QueueUrl: queueUrl, ReceiptHandle: m.ReceiptHandle })
        }
        log(`Bad message: not a valid json ${m.Body}`)
        continue
      }
      const decoded = decode(inputType, body)
      if (!decoded.pass) {
        if (specifications.malformedMessagePolicy === 'delete') {
          await client.deleteMessage({ QueueUrl: queueUrl, ReceiptHandle: m.ReceiptHandle })
        }
        log(`Bad message: ${JSON.stringify(decoded.errors)}`)
        continue
      }
      const contextInput = await context({ message: m })
      const ctx = await module.context(contextInput)
      await functionBody.apply({
        input: decoded.value,
        projection: undefined,
        operationId,
        context: ctx,
        log,
      })
      await client.deleteMessage({ QueueUrl: queueUrl, ReceiptHandle: m.ReceiptHandle })
      log(`Completed.`)
    } catch (error) {
      if (error instanceof Error) {
        listenerLog(error.message, 'error')
      }
      await sleep(1000)
    }
  }
  listenerLog('Stopped.')
}
