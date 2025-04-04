# Logging

Mondrian Framework provides a built-in, convenient logging mechanism integrated directly into the function execution context. This system is designed to be easy to use while adhering to modern observability standards by leveraging the [OpenTelemetry](https://opentelemetry.io/) specification for logs.

## Automatic Logger Injection

When you implement a Mondrian function, an instance of the `MondrianLogger` is automatically provided as part of the arguments passed to the `body` function. You don't need any special setup to access it; it's always available alongside `input`, `retrieve`, `tracer`, and any context from providers.

```ts showLineNumbers
import { model, result } from '@mondrian-framework/model'
import { functions } from '@mondrian-framework/module'

const myActionDefinition = functions.define({
  input: model.object({ data: model.string() }),
  output: model.boolean(),
})

const myAction = myActionDefinition.implement({
  // highlight-start
  async body({ input, logger }) {
    // Logger instance is readily available
    logger.logInfo('Starting myAction execution', { inputDataLength: input.data.length })

    if (input.data === 'error') {
      logger.logError('Received error trigger in input', { received: input.data })
      return result.ok(false)
    }

    // ... perform action logic ...

    logger.logDebug('myAction completed successfully')
    return result.ok(true)
  },
  // highlight-end
})
```

## Logging Methods

The `MondrianLogger` instance offers five simple methods corresponding to standard severity levels:

- `logger.logDebug(message, attributes?)`
- `logger.logInfo(message, attributes?)`
- `logger.logWarn(message, attributes?)`
- `logger.logError(message, attributes?)`
- `logger.logFatal(message, attributes?)`

Each method accepts a required `message` (string) and an optional `attributes` object (key-value pairs) to add structured context to the log entry, following OpenTelemetry conventions.

## Automatic Context

The logger automatically includes contextual information with each log record, such as:

- `moduleName`: The name of the module the function belongs to.
- `operationName`: The name of the function being executed.

This built-in context helps in filtering and analyzing logs without requiring manual additions in every log statement. You can further enrich the context by providing attributes specific to the log message.

By integrating OpenTelemetry-based logging directly into the function context, Mondrian simplifies the process of adding effective observability to your applications.
