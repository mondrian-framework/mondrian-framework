import { logs } from '@opentelemetry/api-logs'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { Resource } from '@opentelemetry/resources'
import { LoggerProvider, SimpleLogRecordProcessor, ConsoleLogRecordExporter } from '@opentelemetry/sdk-logs'
import { SimpleSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'
import { PrismaInstrumentation } from '@prisma/instrumentation'

const provider = new NodeTracerProvider({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: process.env.MODULE_NAME,
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.MODULE_VERSION,
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
