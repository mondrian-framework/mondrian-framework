import { Infer } from '@mondrian-framework/model'
import { Functions, Logger, Module, buildLogger, randomOperationId } from '@mondrian-framework/module'
import { ScheduledTask } from 'node-cron'
import { schedule, validate } from 'node-cron'

export type CronFunctionSpecs<Input> = ([Input] extends [void] ? {} : { input: () => Promise<Input> }) & {
  cron: string
  runAtStart?: boolean
  timezone?: string
}
export type CronApi<F extends Functions> = {
  functions: {
    [K in keyof F]?: CronFunctionSpecs<Infer<F[K]['input']>>
  }
}

export function start<const F extends Functions, CI>({
  module,
  api,
  context,
}: {
  module: Module<F, CI>
  api: CronApi<F>
  context: (args: { cron: string }) => Promise<CI>
}): { close: () => Promise<void> } {
  const scheduledTasks: { task: ScheduledTask; logger: () => Logger }[] = []
  for (const [functionName, functionBody] of Object.entries(module.functions.definitions)) {
    const options = api.functions[functionName]
    if (!options) {
      continue
    }
    if (!validate(options.cron)) {
      throw new Error(`Invalid cron string ${options.cron}`)
    }
    const task = schedule(
      options.cron,
      async () => {
        const operationId = randomOperationId()
        const log = buildLogger(module.name, operationId, options.cron, functionName, 'CRON', new Date())
        try {
          const input = 'input' in options ? await options.input() : null
          const contextInput = await context({ cron: options.cron })
          const ctx = await module.context(contextInput, { input, projection: undefined, operationId, log })
          await functionBody.apply({ input, projection: undefined, operationId, log, context: ctx })
        } catch (error) {
          if (error instanceof Error) {
            log(error.message, 'error')
          }
          log('Unknown error', 'error')
        }
        log('Done.')
      },
      {
        runOnInit: options.runAtStart ?? false,
        recoverMissedExecutions: false,
        timezone: options.timezone,
      },
    )
    task.start()
    scheduledTasks.push({
      task,
      logger: () => buildLogger(module.name, null, options.cron, functionName, 'CRON', new Date()),
    })
  }

  return {
    async close() {
      buildLogger(module.name, null, null, null, 'CRON', new Date())('Stopping jobs...')
      for (const { task, logger } of scheduledTasks) {
        task.stop()
        logger()('Stopped.')
      }
    },
  }
}
