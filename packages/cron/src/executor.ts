import { Infer, Types } from '@mondrian/model'
import { Functions, Logger, Module, buildLogger, randomOperationId } from '@mondrian/module'
import { ScheduledTask } from 'node-cron'
import { validate, schedule } from 'node-cron'

export type CronFunctionSpecs<Input> = ([Input] extends [void] ? {} : { input: () => Promise<Input> }) & {
  cron: string
  runAtStart?: boolean
  timezone?: string
}
export type ModuleCronApi<T extends Types, F extends Functions> = {
  functions: {
    [K in keyof F]?: CronFunctionSpecs<Infer<T[F[K]['input']]>>
  }
}

export function start<const T extends Types, const F extends Functions<keyof T extends string ? keyof T : string>, CI>({
  module,
  api,
  context,
}: {
  module: Module<T, F, CI>
  api: ModuleCronApi<T, F>
  context: (args: { cron: string }) => Promise<CI>
}): { close: () => Promise<void> } {
  const scheduledTasks: { task: ScheduledTask; logger: () => Logger }[] = []
  for (const [functionName, functionBody] of Object.entries(module.functions)) {
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
          const ctx = await module.context(contextInput)
          await functionBody.apply({ input, fields: undefined, operationId, log, context: ctx })
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
