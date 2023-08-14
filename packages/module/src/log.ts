/**
 * The Mondrian logger type.
 */
export type Logger = (message: string, level?: 'log' | 'warn' | 'error') => void | Promise<void>

export function builder(): LoggerBuilder {
  return new LoggerBuilder({})
}

type LoggerContext = {
  moduleName?: string
  operationId?: string
  operationType?: string //QUERY, MUTATION, GET, POST, SQS-URL ...
  operationName?: string
  server?: string //REST, GRAPHQL, LOCAL, ...
}

class LoggerBuilder {
  private createdAt: Date
  private context: LoggerContext

  constructor(context: LoggerContext) {
    this.createdAt = new Date()
    this.context = context
  }

  public with(context: LoggerContext): LoggerBuilder {
    return new LoggerBuilder({ ...this.context, ...context })
  }

  public build(): Logger {
    return (message: string, level?: 'log' | 'warn' | 'error') => {
      const op =
        this.context.operationType && this.context.operationName
          ? `${this.context.operationType} / ${this.context.operationName}`
          : this.context.operationName
          ? this.context.operationName
          : this.context.operationType
          ? this.context.operationType
          : null
      console[level ?? 'log'](
        `${this.context.operationId ? `[${this.context.operationId}] ` : ''}[${
          this.context.moduleName ?? 'Unknown-Module'
        }${op ? ` / ${op}` : ''} / ${this.context.server ?? 'Unknown-Server'}]: ${message} (${
          new Date().getTime() - this.createdAt.getTime()
        } ms)`,
      )
    }
  }
}
