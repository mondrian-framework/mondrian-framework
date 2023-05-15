import { Infer, Types, decode } from '@mondrian/model'
import { ContextType, Functions, GenericModule, Logger, Module, buildLogger, randomOperationId } from '@mondrian/module'
import { sleep } from '@mondrian/utils'
import { ScheduledTask } from 'node-cron'
import { validate, schedule } from 'node-cron'

export type CronFunctionSpecs<Input> = {
  cron: string
  runAtStart?: boolean
  timezone?: string
  input: () => Promise<Input>
}
export type ModuleCronApi<T extends Types, F extends Functions> = {
  functions: {
    [K in keyof F]?: CronFunctionSpecs<Infer<T[F[K]['input']]>>
  }
}

export function cron<const T extends Types, const F extends Functions<keyof T extends string ? keyof T : string>>({
  module,
  api,
  context,
}: {
  module: Module<T, F>
  api: ModuleCronApi<T, F>
  context: (args: {}) => Promise<ContextType<F>>
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
          const input = await options.input()
          const ctx = await context({})
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
