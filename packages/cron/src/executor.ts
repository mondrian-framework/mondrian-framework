import { Api } from './api'
import { model } from '@mondrian-framework/model'
import { functions, utils, logger } from '@mondrian-framework/module'
import { ScheduledTask } from 'node-cron'
import { schedule, validate } from 'node-cron'

/**
 * TODO: doc
 */
export function start<const F extends functions.Functions, CI>({
  api,
  context,
}: {
  api: Api<F, CI>
  context: (args: { cron: string }) => Promise<CI>
}): { close: () => Promise<void> } {
  const baseLogger = logger.build({ moduleName: api.module.name, server: 'CRON' })
  const scheduledTasks: { task: ScheduledTask }[] = []
  for (const [functionName, functionBody] of Object.entries(api.module.functions)) {
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
        const operationId = utils.randomOperationId()
        const operationLogger = baseLogger.updateContext({
          operationId,
          operationType: options.cron,
          operationName: functionName,
        })
        try {
          const input = model.isNever(functionBody.input) ? undefined : await options.input()
          const contextInput = await context({ cron: options.cron })
          const ctx = await api.module.context(contextInput, {
            input,
            retrieve: undefined,
            operationId,
            logger: operationLogger,
            functionName,
          })
          await functionBody.apply({
            input: input as never,
            retrieve: {},
            operationId,
            logger: operationLogger,
            context: ctx,
          })
        } catch {}
      },
      {
        runOnInit: options.runAtStart ?? false,
        recoverMissedExecutions: false,
        timezone: options.timezone,
      },
    )
    task.start()
    scheduledTasks.push({ task })
  }

  return {
    async close() {
      for (const { task } of scheduledTasks) {
        task.stop()
      }
    },
  }
}
