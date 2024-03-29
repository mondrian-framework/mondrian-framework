import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { FastifyInstrumentation } from '@opentelemetry/instrumentation-fastify'
import { GraphQLInstrumentation } from '@opentelemetry/instrumentation-graphql'
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http'
import { Resource } from '@opentelemetry/resources'
import { SimpleLogRecordProcessor, LogRecordExporter } from '@opentelemetry/sdk-logs'
import * as opentelemetry from '@opentelemetry/sdk-node'
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_DEPLOYMENT_ENVIRONMENT } from '@opentelemetry/semantic-conventions'
import { PrismaInstrumentation } from '@prisma/instrumentation'

class MyConsoleLogRecordExporter implements LogRecordExporter {
  export(
    logs: opentelemetry.logs.ReadableLogRecord[],
    resultCallback: (result: opentelemetry.core.ExportResult) => void,
  ): void {
    for (const log of logs) {
      console.log(
        `${log.attributes.server} -> [${log.severityText}, ${new Date(
          log.hrTime[0] * 1000 + log.hrTime[1] / 1000000,
        ).toISOString()}] ${log.body}`,
      )
    }
    resultCallback({ code: opentelemetry.core.ExportResultCode.SUCCESS })
  }
  async shutdown(): Promise<void> {}
}

const traceExporter = new OTLPTraceExporter({ url: process.env.OTLP_EXPORTER_URL })
const logRecordProcessor = new SimpleLogRecordProcessor(new MyConsoleLogRecordExporter())

const sdk = new opentelemetry.NodeSDK({
  serviceName: process.env.MODULE_NAME,
  resource: new Resource({
    [SEMRESATTRS_SERVICE_NAME]: process.env.MODULE_NAME,
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: process.env.ENVIRONMENT,
  }),
  traceExporter,
  logRecordProcessor,
  instrumentations: [
    new HttpInstrumentation(),
    new FastifyInstrumentation(),
    ...(process.env.PRISMA_INTRUMENTATION === 'true' ? [new PrismaInstrumentation()] : []),
    new GraphQLInstrumentation(),
  ],
})

sdk.start()
