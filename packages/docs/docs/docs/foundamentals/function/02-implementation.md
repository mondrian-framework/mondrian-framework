# Implementation

The implementation of a function constitutes the business logic that represents its behavior.
Given inputs, it generates the expected outputs or defined errors.

In Mondrian, a function is implemented by starting with its [definition](./01-definition.md) and
invoking the `implement` method on that definition.

```ts showLineNumbers
import { createPostDefinition } from './definitions'
import { result } from '@mondrian-framework/model'

const createPost = createPostDefinition.implement({
  body: async ({ input }) => {
    // const output = ...
    return result.ok(output)
  },
})
```

This method has a mandatory `body` parameter where you must define an asynchronous function
(returning a Promise) containing your implementation. The parameters of this `body` function are dynamic, based
on the function's definition.

## Input

The input parameter's type depends on the corresponding function definition; it's essentially an application of
the [`model.Infer`](../model/02-typing.md#type-inference) utility type to the input schema.

```ts showLineNumbers
const PostInput = model.object({
  title: model.string(),
  content: model.string(),
  authorId: model.string(),
})
// highlight-start
type PostInput = model.Infer<typeof PostInput>
// highlight-end

const createPostDefinition = functions.define({
  input: PostInput,
  output: model.string(),
})

const createPost = createPostDefinition.implement({
  body: async ({ input }) => {
    // highlight-start
    // typeof input => PostInput
    // highlight-end
    return result.ok(output)
  },
})
```

The input to a function should always be considered valid, meaning it conforms to the validation
rules defined by its Mondrian type. The runtime invoking the function is responsible
for this validation and, if the input doesn't conform, returning an error to the caller.

Within the function implementation, therefore, no additional checks on the basic conformity of the input are necessary,
although you can, of course, implement as many additional business rule checks and related errors as needed.

## Output

The implementation of a function must return a value that conforms to what is described in its definition,
whether it be a success output or a defined error.

Mondrian provides a utility module named `result` to facilitate this implementation in a functional style,
as shown below.

```ts showLineNumbers
import { result } from '@mondrian-framework/model'

const createPost = createPostDefinition.implement({
  async body({ input, context, logger }) {
    //this could also be checked by the schema (... content: model.string({ minLength: 10 }) ...)
    if (input.content.lenght < 10) {
      return result.fail({ contentMinLength: 'Content must be at least of 10 characters.' })
    }
    const postId = await context.repository.posts.insertOne(input)
    return result.ok(postId)
  },
})
```

You must remember that in Mondrian, both successful results and defined errors are treated as return values; application
errors are not handled using exceptions and `throw`. This approach is inspired by functional programming languages.

:::warning
A common mistake when using the `fail` function is omitting the `return` keyword. Omitting `return` before `result.fail(...)`
may not generate a compile-time error but can lead to unexpected runtime behavior, as the function might continue execution.
It is a best practice to **always return the result** of an `ok` or `fail` call immediately.
:::

## Logger

Mondrian provides a ready-to-use, convenient, and configurable logging mechanism available in any function.
When implementing the `body`, you can simply use the instance of the logger provided as an additional parameter.

```ts showLineNumbers
const createPost = createPostDefinition.implement({
  async body({ input, context, logger }) {
    logger.logDebug('Function start')
    // ...
    logger.logInfo('Some meaningful informations')
    // ...
    logger.logDebug('Function completed')
    // return ...
  },
})
```

Mondrian's logger is heavily based on [OpenTelemetry](https://opentelemetry.io/), an open-source, vendor-neutral standard
that is extremely popular for observability features.

It offers five simple methods for logging at different severity levels: `logDebug`, `logInfo`, `logWarn`, `logError`, `logFatal`. Each
of these functions accepts a required message string and, as a second optional parameter, a key-value object (attributes) in which to specify additional details (OpenTelemetry attributes).

More details on logging can be found in the [dedicated guide](../../guides/05-logging.md).

## Tracer

Similar to the logging capabilities, Mondrian provides ready-to-use support for tracing, also based on [OpenTelemetry](https://opentelemetry.io/). When implementing the `body` of a function, you can use the instance of the tracer provided as an additional parameter.

```ts showLineNumbers
const createPost = createPostDefinition.implement({
  async body({ input, context, tracer }) {
    tracer.startActiveSpan('create-post', (span) => {
      try {
        // ...
        span?.end()
      } catch (error) {
        if (error instanceof Error) {
          span?.recordException(error)
        }
        span?.setStatus({ code: SpanStatusCode.ERROR })
        span?.end()
      }
    })
  },
})
```

You can also specify additional tracing options using the `startActiveSpanWithOptions` method.

More details on tracing can be found in the [dedicated guide](../../guides/06-tracing.md).
