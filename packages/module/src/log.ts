/**
 * The Mondrian logger type.
 */
export type Logger = (message: string, level?: 'log' | 'warn' | 'error') => void | Promise<void>

type LoggerContext = {
  moduleName?: string
  operationId?: string
  operationType?: string //QUERY, MUTATION, GET, POST, SQS-URL ...
  operationName?: string
  server?: string //REST, GRAPHQL, LOCAL, ...
}

class LoggerBuilder {
  private createdAt: Date
  private _context: LoggerContext

  constructor(context: LoggerContext) {
    this.createdAt = new Date()
    this._context = context
  }

  public context(context: LoggerContext): LoggerBuilder {
    return new LoggerBuilder({ ...this._context, ...context })
  }

  public build(): Logger {
    return (message: string, level?: 'log' | 'warn' | 'error') => {
      const op =
        this._context.operationType && this._context.operationName
          ? `${this._context.operationType} / ${this._context.operationName}`
          : this._context.operationName
          ? this._context.operationName
          : this._context.operationType
          ? this._context.operationType
          : null
      console[level ?? 'log'](
        `${this._context.operationId ? `[${this._context.operationId}] ` : ''}[${
          this._context.moduleName ?? 'Unknown-Module'
        }${op ? ` / ${op}` : ''} / ${this._context.server ?? 'Unknown-Server'}]: ${message} (${
          new Date().getTime() - this.createdAt.getTime()
        } ms)`,
      )
    }
  }
}

export const builder = new LoggerBuilder({})
