# Implementation

The implementation of a function is basically the business logic that represents its behavior. 
Given some inputs generates expected outputs with any side effects on a context.

In Mondrian, a function is implemented by starting with its [definition](./01-definition.md) and 
invoking the `implement` method.

```ts showLineNumbers
import { result } from '@mondrian-framework/model'
import { createPostDefinition } from './definitions'

const createPost = createPostDefinition.implement({
  body: async ({ input }) => {
    // const output = ...
    return result.ok(output)
  }
})
```

## Input

The input parameter type depends on the respective definition, it's basically an application of 
the [`model.Infer`](../model/02-typing.md#type-inference) utility type to the input definiton.

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
  }
})
```

The input of a function is to be considered always valid, that is, conforming to the validation
rules defined by its Mondrian type. It is the runtime that will execute the function that will 
take care of this validation and, if it does not conform, return an error to the caller.

Within the function, therefore, no additional checks on the conformity of the input are necessary, 
but you can of course implement as many additional checks and related errors as you want.

## Context

A *pure function* is a function that has no side effect or internal state and, given a specific input, 
always returns the same output. Pure functions are easy to test and generally produce few errors, but 
it is not always possible or otherwise simple to design a system using only them.

Many times within a function it is necessary to interact with other parts of the system, such as 
infrastructure components (databases, queues, etc.), other modules or external systems (third-party 
APIs as an example).

In a Mondrian function all these interactions pass through an object called `context`. The context can 
be thought of as the container of all the services, ports and adapters that a function can use to interact 
with everything outside. It will then be the responsability to the [module](../module/index.md) and the 
[runtime](../runtime/index.md) on which it runs to instantiate the context so that it meets the requirements 
of all functions.

In the implementation of a function in Mondrian, the context is one of the parameters, and its type can be 
explicitly specified using a generic.

```ts showLineNumbers
// highlight-start
type Context = { repository: Repository }
// highlight-end

// highlight-start
const createPost = createPostDefinition.implement<Context>({
    async body({ input, context }) {    
// highlight-end
      const postId = await context.repository.posts.insertOne(input)
      return result.ok(postId)
    },
  })
```

:::warning
It is extremely important that each function declare **as little context as possible** to implement its logic, 
to avoid introducing **unnecessary dependencies**. You must remember that every dependency and every side effect 
you introduce within a function decreases its testability and increases the possibility of creating error.
:::

:::info
What about the **difference between context and an input**? Basically the context, from the point 
of view of the function, is indeed an input, but unlike the others it is not provided by the caller but by the 
module and the runtime that executes it. Also, unlike inputs that are normally immutable, context may not be, and 
through it actions and commands can be executed.
::::

## Output

The implementation of a function must have a return value that conforms to when described in the definition, be it 
an output or an error.

Mondrian provides a utility module named `result` to facilitate this implementation, as shown below.

```ts showLineNumbers
import { result } from '@mondrian-framework/model'

const createPost = createPostDefinition.implement({
  async body({ input, context, logger }) {    
    if(input.content.lenght < 10){
      return result.fail({ contentMinLength: 'Content must be at least of 10 characters.' })
    }
    const postId = await context.repository.posts.insertOne(input)
    return result.ok(postId)
  },
})
```

You must remember that in Mondrian both errors and results are treated as return values, and no application 
errors are handled using exceptions and `throw`. This approach is freely inspired by many functional languages.

So every function must always return a value or failure, and to do this the framework puts two respective 
functions `ok` and `fail`. They are strictly typed accordingly to the function definition, both in terms of 
output and errors.

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
    logger.logDebug("Function start")
    // ...
    logger.logInfo("Some meaningful informations")
    // ...
    logger.logDebug("Function completed")
    // return ...
  },
})
```

Mondrian's logger is heavily based on [OpenTelemetry](https://opentelemetry.io/), an open source, vendor neutral standard 
that is extremely popular for observability features.

It offers five simple methods for logging at different levels: `logDebug`, `logInfo`, `logWarn`, `logError`, `logFatal`. Each 
of these functions accepts a free string and, as a second parameter, a key-value object in which to specify additional details.

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
      } catch(error) {
        if (error instanceof Error) {
          span?.recordException(error)
        }
        span?.setStatus({ code: SpanStatusCode.ERROR })
        span?.end()
      }
    })
  }
})
```
You can also specify additional tracing options using the `startActiveSpanWithOptions` method.

More details on tracing in the [section on this topic](../../guides/05-logging.md).
