import { logs, LogRecord, LogAttributes, Logger, SeverityNumber } from '@opentelemetry/api-logs'

/**
 * The Mondrian logger, extends opentelemetry {@link Logger}.
 */
export class MondrianLogger implements Logger {
  private readonly logger: Logger
  private readonly context: MondrianLoggerContext

  constructor(logger: Logger, context: MondrianLoggerContext) {
    this.logger = logger
    this.context = context
  }
  emit(logRecord: LogRecord): void {
    this.logger.emit({
      ...logRecord,
      attributes: {
        ...logRecord.attributes,
        ...this.context,
      },
    })
  }
  logDebug(message: string, attributes?: LogAttributes): void {
    this.emit({ body: message, severityNumber: SeverityNumber.DEBUG, severityText: 'DEBUG', attributes })
  }
  logInfo(message: string, attributes?: LogAttributes): void {
    this.emit({ body: message, severityNumber: SeverityNumber.INFO, severityText: 'INFO', attributes })
  }
  logWarn(message: string, attributes?: LogAttributes): void {
    this.emit({ body: message, severityNumber: SeverityNumber.WARN, severityText: 'WARN', attributes })
  }
  logError(message: string, attributes?: LogAttributes): void {
    this.emit({ body: message, severityNumber: SeverityNumber.ERROR, severityText: 'ERROR', attributes })
  }
  logFatal(message: string, attributes?: LogAttributes): void {
    this.emit({ body: message, severityNumber: SeverityNumber.FATAL, severityText: 'FATAL', attributes })
  }
  updateContext(context: MondrianLoggerContext): MondrianLogger {
    return new MondrianLogger(this.logger, { ...this.context, ...context })
  }
}

type MondrianLoggerContext = {
  moduleName?: string
  operationId?: string
  operationType?: string //QUERY, MUTATION, GET, POST, SQS-URL ...
  operationName?: string
  server?: string //REST, GRAPHQL, LOCAL, ...
}

export function build(context: MondrianLoggerContext): MondrianLogger {
  //TODO: always use 'default' logger?
  return new MondrianLogger(logs.getLogger('default'), context)
}
