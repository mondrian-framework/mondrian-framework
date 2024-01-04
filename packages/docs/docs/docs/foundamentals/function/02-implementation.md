# Implementation

The implementation of a function is basically the business logic that represents its behavior. 
Given some inputs generates expected outputs with any side effects on a context.

In Mondrian, a function is implemented by starting with its [definition](./01-definition.md) and 
invoking the `implement` method.

```ts showLineNumbers
import { createPostDefinition } from './definitions'

const createPost = createPostDefinition.implement({
  body: async ({ input }) => {
    // const output = ...
    return output
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
    return output
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
      return postId
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

More details on logging in the [section on this topic](../../07-logging.md).

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

More details on tracing in the [section on this topic](../../07-logging.md).

## Middleware

Mondrian supports the concept of middleware at many levels, one of which is at the function level. In the 
implementation of each function, it is possible to specify a list of middleware that is applied respecting 
the order provided. 

Each middleware receives as input the same parameters as the function and is allowed to change them before 
moving on to the next middleware or, finally, to the execution of the function. Each middleware can then 
also add logic subsequent to the execution of the function.

```ts showLineNumbers
const createPost = createPostDefinition.implement({
  body: async () => {
    // ...
  },
  // highlight-start
  middlewares: [
    {
      name: "dummy-middleware",
      async apply(args, next, fn) {
        // do something before
        const result = await next(args)
        // do somthing after
        return result
      },
    }
  ],
  // highlight-end
})
```

Middleware can be particularly useful in reusing over multiple functions code that is not strictly dependent 
on their internal logic. Some internal framework mechanisms are also implemented as middleware that are 
applied by default to all functions.

Mondrian also offers some ready-to-use utility middleware, and others are provided by the community.

### Rate limiter

The rate limiter is middleware provided by the framework and ready to be used on any function. It allows 
the number of calls to a function to be limited based on input or context, with configurable rules.

This middleware is provided as a separate package that can be installed as needed.
```
> npm i @mondrian-framework/rate-limiter
```

Its use is simple and requires the configuration of a few simple options.
```ts showLineNumbers
// highlight-start
import { RateLiteral, rateLimiter } from '@mondrian-framework/rate-limiter'
// highlight-end 

// highlight-start
const loginRateLimit: RateLiteral = '10 requests in 1 minute'
// highlight-end

const createPost = createPostDefinition.implement({
  body: async () => {
    // ...
  },
  middlewares: [
    // highlight-start
    rateLimiter.build({
      key: ({ input }) => input.email,
      rate: loginRateLimit,
      onLimit: async () => {
        return result.fail({ tooManyRequests: 'Too many requests. Retry in few minutes.' })
      },
    }),
    // highlight-end
  ],
})
```

As shown in the previous example, the rate can be configured as desired in a textual manner, 
respecting the pattern defined by the `RateLiteral` type.

The `key` field, on the other hand, identifies the grouping key for the requests, the one for 
which they are counted together. This key can be constructed from any input parameter.

Finally, the `onLimit` function is invoked whenever a function is executed and the limit is 
reached. In it you can decide to implement the desired limiting behavior, e.g., you can return 
an error to the caller.

By default the time slots needed to count requests are kept in memory, this means that in the 
case of horizontal scaling the rate is not shared, but independent for each instance.

#### Redis slot provider 
Thus, the typical configuration involves an external infrastructure component with a storage role. 
The framework provides an implementation on [Redis](https://redis.io/) in-memory database, which is 
very common for these applications.

After installing a Node.js Redis client library,
```
> npm i @redis/client
```

You can setup a slot provider as following:

```ts showLineNumbers
import { RedisSlotProvider, SlotProvider, RateLiteral, rateLimiter } from '@mondrian-framework/rate-limiter'
// highlight-start
import { createClient } from '@redis/client'
// highlight-end

// highlight-start
const redisClient = process.env.REDIS_URL ? createClient() : undefined
redisClient?.on('error', (err) => console.log('Redis Client Error', err))
redisClient?.connect()

const slotProvider: SlotProvider | undefined = redisClient && new RedisSlotProvider(redisClient)
// highlight-end

const loginRateLimit: RateLiteral = '10 requests in 1 minute'
const createPost = createPostDefinition.implement({
  body: async () => {
    // ...
  },
  middlewares: [
    rateLimiter.build({
      key: ({ input }) => input.email,
      rate: loginRateLimit,
      onLimit: async () => {
        return result.fail({ tooManyRequests: 'Too many requests. Retry in few minutes.' })
      },
      // highlight-start
      slotProvider
      // highlight-end
    }),
  ],
})
```

However, it is possible to implement other solutions, with infrastructure components of other types, 
such as SQL or noSQL databases or on shared files. You can find more solutions from the community.