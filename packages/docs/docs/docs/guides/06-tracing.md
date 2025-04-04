# Tracing

Mondrian Framework provides built-in support for distributed tracing, enabling you to monitor the flow of requests across your application and external services. This is seamlessly integrated into the function execution context and adheres to the [OpenTelemetry](https://opentelemetry.io/) standard, a widely adopted specification for observability.

## Automatic Tracer Injection

Similar to the logger, an instance of the `Tracer` is automatically provided as part of the arguments passed to the `body` function when you implement a Mondrian function. No extra setup is needed to access it; it's available alongside `input`, `retrieve`, `logger`, and context from providers.

```ts showLineNumbers
import { model, result } from '@mondrian-framework/model'
import { functions } from '@mondrian-framework/module'
import { SpanStatusCode } from '@opentelemetry/api'

// Import OpenTelemetry types if needed

const processDataDefinition = functions.define({
  input: model.object({ dataId: model.string() }),
  output: model.boolean(),
})

const processData = processDataDefinition.implement({
  // highlight-start
  async body({ input, logger, tracer }) {
    // Tracer instance is available
    return tracer.startActiveSpan('processDataExecution', async (span) => {
      logger.logInfo('Starting processData execution', { dataId: input.dataId })
      try {
        // Simulate some work that might interact with external systems
        await externalServiceCall(input.dataId)

        logger.logDebug('processData completed successfully')
        span?.setStatus({ code: SpanStatusCode.OK })
        span?.end()
        return result.ok(true)
      } catch (error) {
        logger.logError('Error during processData execution', { error })
        span?.recordException(error as Error) // Record the exception on the span
        span?.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message })
        span?.end()
        // Decide how to handle the error in the function's result
        // For simplicity, returning false, but could return a specific error result
        return result.ok(false)
      }
    })
  },
  // highlight-end
})

// Dummy function for example purposes
async function externalServiceCall(id: string): Promise<void> {
  // Imagine this calls another service or database
  await new Promise((resolve) => setTimeout(resolve, 50))
  if (id === 'fail') {
    throw new Error('External service failed')
  }
}
```

## Tracer Methods

The provided `tracer` instance offers methods based on the OpenTelemetry `Tracer` interface:

- `tracer.startActiveSpan(name, fn)`: Starts a new span, makes it the active span for the duration of the provided synchronous or asynchronous function `fn`, and automatically ends the span when `fn` completes or throws.
- `tracer.startActiveSpanWithOptions(name, options, fn)`: Similar to `startActiveSpan`, but allows providing additional OpenTelemetry `SpanOptions` (like `kind`, `attributes`, `links`).

Within the function passed to `startActiveSpan` (or `startActiveSpanWithOptions`), you receive the `span` object (which might be `undefined` if tracing is disabled). You can use this `span` object to:

- `span?.setStatus({ code, message? })`: Set the status of the span (e.g., `OK` or `ERROR`).
- `span?.recordException(error)`: Record an error or exception that occurred during the span's execution.
- `span?.setAttribute(key, value)` / `span?.setAttributes(attributes)`: Add custom attributes (key-value pairs) to the span for richer context.
- `span?.end()`: Explicitly end the span (though `startActiveSpan` handles this automatically in most cases).

## Automatic Context

Like the logger, the tracer automatically associates spans with essential context:

- `moduleName`: The name of the Mondrian module.
- `operationName`: The name of the Mondrian function being executed.
- Semantic conventions attributes like `code.function` and `code.namespace` are often added automatically.

This built-in context, combined with the spans you create for specific operations, provides a detailed view of request processing within your Mondrian application, integrating smoothly with OpenTelemetry-compatible observability platforms.
