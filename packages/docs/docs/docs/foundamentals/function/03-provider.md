# Provider

Quite often, the implementation of a function requires data, connections, or other resources that don't depend on the function's direct input but rather on the context in which it's executed. To inject these dependencies within a function and make them available for the application logic, Mondrian offers a construct called a 'provider'.

## Definition

To define a provider, you can use the `provider` builder available in the `@mondrian-framework/module` package.

```typescript
import { result } from '@mondrian-framework/model'
import { provider } from '@mondrian-framework/module'
import { PrismaClient } from '@prisma/client'

const prismaSingleton = new PrismaClient()
export const prismaProvider = provider.build({
  body: async () => {
    return result.ok(prismaSingleton)
  },
})
```

This example shows how to provide a reference to a singleton instance of [Prisma](https://www.prisma.io/), a well-known TypeScript ORM. Note that a provider is similar to a function but doesn't require the definition of input and output types. This is because providers don't contribute to the function's public contract or the generation of API specifications; they only affect the implementation details.

A provider might simply provide a resource it creates from scratch, but it often requires some **contextual input**. These inputs are not the same as a function's inputs (which come directly from the caller). Instead, they are inputs that the runtime and module must construct for each invocation. They generally represent data related to the call context, such as the caller's identity, or data related to the execution environment, such as additional details about the runtime.

A provider can declare these required inputs freely by specifying them as parameters of its `body` function. It then becomes the responsibility of the module and the runtime to provide all the data required by all providers during execution.

```typescript
import { result } from '@mondrian-framework/model'
import { provider } from '@mondrian-framework/module'

type AuthProviderContextInput = { token?: string }

export const authProvider = provider.build({
  body: async ({ token } : AuthProviderContextInput) => {
    if (token) {
      // validate token
      const userId = ...
      return result.ok({ userId })
    }
    return result.ok<{ userId?: string }>({})
  },
})
```

In this example, the `authProvider` requires an optional `token` as contextual input, validates it, and returns an optional user ID, which can then be used as an additional input for functions that depend on this provider.

## Usage

To use one or more providers, you must declare them in the function implementation using the `use` method.

```typescript
const readPosts = readPostDefinition
  // highlight-start
  .use({ providers: { prisma: prismaProvider } })
  // highlight-end
  .implement({
    // highlight-start
    async body({ input, prisma }) {
    // highlight-end
      const posts = await prisma.posts.findMany({ ... }) // retrieve posts using the prisma client
      return result.ok(posts)
    },
  })
```

Thanks to Mondrian's typing engine, the `body` function's parameters are automatically enriched with the outputs returned by each declared provider. This ensures strict type checking between the declared providers and the resources available within the function's implementation.

A provider can be shared by multiple functions, which is a typical use case. It is **invoked once for each execution** of every function that declares its use. This is important to consider when deciding how to construct the resources returned by a provider. If you wish to define a provider that acts as a singleton (i.e., returns the identical object instance for every function execution), implement it as shown in the first example on this page (instantiating the resource outside the provider's body).

## Dependency

A provider can also depend on other providers, forming chains of dependencies. This allows useful logic to be reused across a set of functions and even other providers, avoiding code duplication.

Similar to how dependencies are declared for functions, you can declare dependencies between providers using the `use` method. When a provider depends on another, the data provided by the parent provider(s) are accessible as part of a second parameter to the `body` function.

```typescript
import { result } from '@mondrian-framework/model'
import { provider } from '@mondrian-framework/module'

export const prismaProvider = ...

type CustomLoggerProviderContextInput = { callerIP: string }
export const customLoggerProvider = provider
  // highlight-start
  .use({ providers: { prisma: prismaProvider } })
  // highlight-end
  .build({
    async body({ callerIP }: AuditProviderContextInput, { prisma }) {
      // log the call to db using prisma client
      const audit = await prisma.audit.create({ data: { callerIP, ... } })
      return result.ok(audit)
    },
})
```

## Errors

A provider can also declare the possibility of returning errors, using the same formalism as functions. Obviously, it can return these errors within its `body` implementation using the `result.fail` utility function.

```typescript
import { result } from '@mondrian-framework/model'
import { provider } from '@mondrian-framework/module'
import { error } from '@mondrian-framework/module'
import { isValid } from './jwt'

type AuthProviderContextInput = { token?: string }

export const authProvider = provider.build({
  // highlight-start
  errors: error.define({
    unauthorized: {
      message: 'Unauthorized access',
      reason: model.enumeration(['InvalidJWT', 'MissingJWT']),
    }
  }),
  // highlight-end
  body: async ({ token } : AuthProviderContextInput) => {
    // highlight-start
    if(!token){
      return result.fail({ unauthorized: { reason: 'MissingJWT' }})
    }
    if (!isValid(token)) {
      return result.fail({ unauthorized: { reason: 'InvalidJWT' }})
    }
    // highlight-end
    const userId = ...
    return result.ok({ userId })
  },
})
```

:::info
Errors defined and potentially returned by a provider must also be declared in the **definition of every function** that uses that provider. This is because, during any function invocation, these errors might be generated by the provider's execution. The function must declare these potential errors so that they are part of its contract and are reflected accurately in generated specifications.
:::

## Mondrian Providers

Mondrian provides a set of built-in providers that can be used in your functions:

- `@mondrian-framework/rate-limiter`

### Rate Limiter

The rate limiter provider allows you to limit the number of requests that can be made to a function within a given time window. This is useful for preventing API abuse and protecting your resources.

To use the rate limiter provider, you need to define a rate limiter configuration and pass it to the provider builder as shown below:

```typescript
import { rateLimiter } from '@mondrian-framework/rate-limiter'

// highlight-start
const rateLimitByEmailProvider = rateLimiter.buildProvider({
  rate: '10 requests in 1 minute',
  // store: new RedisStore(redisClient) // optional, on production environments it is recommended to use a redis store
})
// highlight-end

export const login = module.functions.login
  .use({
    providers: { rateLimiterByEmail: rateLimitByEmailProvider },
  })
  .implement({
    async body({ input: { email, password }, rateLimiterByEmail }) {
      //check if this email is rate limited

      // highlight-start
      const rateLimiterKey = `login:${email}`
      if (rateLimiterByEmail.check(rateLimiterKey) === 'rate-limited') {
        return result.fail({ tooManyRequests: { limitedBy: 'email' } })
      }
      rateLimiterByEmail.apply(email) // Count failure on rate limiter
      // highlight-end

      // ... login logic
      return result.ok(jwt)
    },
  })
```

The rate-limiter feature also comes in the form of a guard, which can be used to protect a function from being called too many times within a given time window. The guard is used similarly to the provider but is applied to the function definition using the `guards` field. More details can be found on the [Guards](./04-guard.md) page.
