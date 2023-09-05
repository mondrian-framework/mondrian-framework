import { CRON_API, REST_API } from './api'
import { startServer } from './good/rest'
import { m, m as module } from './module'
import { cron } from '@mondrian-framework/cron'
import { server as restServer } from '@mondrian-framework/rest-fastify'
import { logs } from '@opentelemetry/api-logs'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { Resource } from '@opentelemetry/resources'
import { LoggerProvider, SimpleLogRecordProcessor, ConsoleLogRecordExporter } from '@opentelemetry/sdk-logs'
import { SimpleSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'
import { PrismaInstrumentation } from '@prisma/instrumentation'
import { fastify } from 'fastify'

const provider = new NodeTracerProvider({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: m.name,
    [SemanticResourceAttributes.SERVICE_VERSION]: m.version,
  }),
})
registerInstrumentations({
  tracerProvider: provider,
  instrumentations: [new PrismaInstrumentation()],
})

if (process.env.OTLP_EXPORTER_URL) {
  provider.addSpanProcessor(new SimpleSpanProcessor(new OTLPTraceExporter({ url: process.env.OTLP_EXPORTER_URL })))
} else {
  provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()))
}

provider.register()

const loggerProvider = new LoggerProvider()
loggerProvider.addLogRecordProcessor(new SimpleLogRecordProcessor(new ConsoleLogRecordExporter()))
logs.setGlobalLoggerProvider(loggerProvider)

async function main() {
  /*
  const server = fastify()
  const time = new Date().getTime()
  restServer.start({
    server,
    module,
    api: REST_API,
    context: async ({ fastify }) => {
      return { jwt: fastify.request.headers.authorization }
    },
    async error({ error, logger, functionName }) {
      if (error instanceof Error) {
        logger.logError(error.message)
        if (functionName === 'login') {
          return { status: 400, body: 'Unauthorized' }
        }
        return { status: 400, body: 'Bad request' }
      }
    },
  })
  */
  /* graphql.serve({
    server,
    module,
    api: GRAPHQL_API,
    context: async ({ fastify }) => {
      return { jwt: fastify.request.headers.authorization }
    },
    async error({ error, fastify, log, functionName }) {
      if (error instanceof Error) {
        log(error.message)
        return { message: 'Invalid JWT' }
      }
    },
  })*/
  /*cron.start({
    module,
    api: CRON_API,
    context: async ({}) => ({}),
  })*/

  const time = new Date().getTime()
  const server = fastify()
  startServer(server)
  const address = await server.listen({ port: 4000 })
  console.log(`Module "${module.name}" has started in ${new Date().getTime() - time} ms! ${address}`)
}

main().then()
