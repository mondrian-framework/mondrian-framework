import { types } from '@mondrian-framework/model'
import { functions, utils, module, logger } from '@mondrian-framework/module'
import { ScheduledTask } from 'node-cron'
import { schedule, validate } from 'node-cron'

export type Api<F extends functions.Functions> = {
  functions: {
    [K in keyof F]?: FunctionSPecifications<types.Infer<F[K]['input']>>
  }
}

type FunctionSPecifications<Input> = {
  cron: string
  runAtStart?: boolean
  timezone?: string
  input: () => Promise<Input>
}

export function start<const F extends functions.Functions, CI>({
  module,
  api,
  context,
}: {
  module: module.Module<F, CI>
  api: Api<F>
  context: (args: { cron: string }) => Promise<CI>
}): { close: () => Promise<void> } {
  const baseLogger = logger.build({ moduleName: module.name, server: 'CRON' })
  const scheduledTasks: { task: ScheduledTask; logger: logger.MondrianLogger }[] = []
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
        const operationId = utils.randomOperationId()
        const operationLogger = baseLogger.updateContext({
          operationId,
          operationType: options.cron,
          operationName: functionName,
        })
        try {
          const input = (await options.input()) as never
          const contextInput = await context({ cron: options.cron })
          const ctx = await module.context(contextInput, {
            input,
            projection: undefined,
            operationId,
            logger: operationLogger,
          })
          await functionBody.apply({ input, projection: undefined, operationId, logger: operationLogger, context: ctx })
        } catch (error) {
          if (error instanceof Error) {
            operationLogger.logError(error.message)
          }
          operationLogger.logError('Unknown error')
        }
        await operationLogger.logInfo('Done.')
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
      logger: baseLogger.updateContext({ operationType: options.cron, operationName: functionName }),
    })
  }

  return {
    async close() {
      baseLogger.logInfo('Stopping jobs...')
      for (const { task, logger } of scheduledTasks) {
        task.stop()
        logger.logInfo('Stopped.')
      }
    },
  }
}
