# Implementation

The implementation of a function is basically the business logic that represents its behavior.
Given some inputs it generates expected outputs.

In Mondrian, a function is implemented by starting with its [definition](./01-definition.md) and
invoking the `implement` method on it.

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

This methos has a mandatory `body` parameter where you must define an asynchronous function
(returning a Promise) containing your implementation. That function has dynamic parameters based
on its definition.

## Input

The input parameter type depends on the respective definition, it's basically an application of
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

The input of a function is to be considered always valid, that is, conforming to the validation
rules defined by its Mondrian type. It is the runtime that will invoke the function that will
take care of this validation and, if it does not conform, return an error to the caller.

Within the function, therefore, no additional checks on the conformity of the input are necessary,
but you can of course implement as many additional checks and related errors as you want.

## Output

The implementation of a function must have a return value that conforms to what described in its definition,
be it an output or an error.

Mondrian provides an utility module named `result` to facilitate this implementation in functional style,
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

You must remember that in Mondrian both errors and results are treated as return values, and no application
errors are handled using exceptions and `throw`. This approach is freely inspired by many functional languages.

:::warning
A typical error in using the `fail` function is the omission of the `return`. Omitting to return a failure in
some cases may generate no error at compile time but only at runtime, so it is important to be careful with it.
It is in general a best practice to **always return the result** of an `ok` or `fail` call.
:::

## Logger

Mondrian provides a ready-to-use, very convenient and configurable logging mechanism that can be used in any function.
When implementing the body you can simply use an instance of the logger provided as an additional parameter.

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

Mondrian's logger is heavily based on [OpenTelemetry](https://opentelemetry.io/), an open source, vendor neutral standard
that is extremely popular for observability features.

It offers five simple methods for logging at different levels: `logDebug`, `logInfo`, `logWarn`, `logError`, `logFatal`. Each
of these functions accepts a free string and, as a second parameter, a key-value object in which to specify additional details (opentelemetry attributes).

More details on logging in the [section on this topic](../../guides/05-logging.md).

## Tracer

Just as mentioned for logging capabilities, Mondrian provides ready-to-use support for tracing, again based on [OpenTelemetry](https://opentelemetry.io/). When implementing the body of a function you can use an instance of the tracer provided as an additional parameter.

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

More details on tracing in the [section on this topic](../../guides/05-logging.md).
