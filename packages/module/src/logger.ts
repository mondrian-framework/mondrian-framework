//TODO: probably need a rework.

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
  private _context: LoggerContext

  constructor(context: LoggerContext) {
    this._context = context
  }

  public build(context?: LoggerContext): Logger {
    return build({ ...this._context, ...context })
  }

  public withContext(context: LoggerContext): LoggerBuilder {
    return new LoggerBuilder({ ...this._context, ...context })
  }
}

export function withContext(context: LoggerContext): LoggerBuilder {
  return new LoggerBuilder(context)
}

export function build(context?: LoggerContext): Logger {
  const now = new Date()
  return (message: string, level?: 'log' | 'warn' | 'error') => {
    const op =
      context?.operationType && context?.operationName
        ? `${context?.operationType} / ${context?.operationName}`
        : context?.operationName
        ? context?.operationName
        : context?.operationType
        ? context?.operationType
        : null
    console[level ?? 'log'](
      `${context?.operationId ? `[${context?.operationId}] ` : ''}[${context?.moduleName ?? 'Unknown-Module'}${
        op ? ` / ${op}` : ''
      } / ${context?.server ?? 'Unknown-Server'}]: ${message} (${new Date().getTime() - now.getTime()} ms)`,
    )
  }
}
