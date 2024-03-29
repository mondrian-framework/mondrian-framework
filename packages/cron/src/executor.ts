import { Api } from './api'
import { model } from '@mondrian-framework/model'
import { functions, utils, logger, module } from '@mondrian-framework/module'
import { SpanKind, SpanStatusCode } from '@opentelemetry/api'
import { ScheduledTask } from 'node-cron'
import { schedule, validate } from 'node-cron'

/**
 * Starts a new cron listeners with the given configuration.
 * For each cron assigned function a new schedule is created.
 */
export function start<Fs extends functions.FunctionImplementations>({
  api,
  context,
}: {
  api: Api<Fs>
  context: (args: { cron: string }) => Promise<module.FunctionsToContextInput<Fs>>
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
        return await functionBody.tracer.startActiveSpanWithOptions(
          `mondrian:cron-handler:${functionName}`,
          {
            kind: SpanKind.INTERNAL,
          },
          async (span) => {
            const operationLogger = baseLogger.updateContext({
              operationType: options.cron,
              operationName: functionName,
            })
            const input = 'input' in options && options.input ? await options.input() : undefined
            if (!model.isType(functionBody.input, input)) {
              const message = `Invalid input generated by cron schedule of function ${functionName} (cron ${options.cron})`
              span?.setStatus({ code: SpanStatusCode.ERROR, message })
              span?.end()
              throw new Error(message)
            }
            try {
              const contextInput = await context({ cron: options.cron })
              //TODO: use rawApply?
              //TODO: add opentelemetry istrumentation
              await functionBody.apply({
                input: input as never,
                retrieve: {},
                logger: operationLogger,
                contextInput: contextInput as Record<string, unknown>,
              })
              span?.end()
            } catch (error) {
              if (error instanceof Error) {
                span?.recordException(error)
              }
              span?.setStatus({ code: SpanStatusCode.ERROR })
              span?.end()
            }
          },
        )
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
