# Provider

Quite often the implementation of a function requires data, connections, or more generally resources, that do not depend on an input but on the context in which it is executed. To inject these dependencies within a function and be able to use them for the development of application logic, Mondrian offers a construct called 'provider'.

## Definition

To define a provider, you can use a module of the same name available in the `@mondrian-framework/module` package.

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

This example shows how to provide a reference to the singleton instance of [Prisma](https://www.prisma.io/), a well-known TypeScript ORM. Note that a provider is very similar to a function but does not need the definition of input and output types. This is because they do not contribute to the definition of a function or the generation of a specification, but only to the implementation.

A provider may simply provide a resource that it can create from scratch, but it often requires some **contextual input**. These inputs are not to be confused with those of a function, which come directly from its invocation, but are inputs that the runtime and the module must construct for each invocation. They generally represent data relating to the context of the call, such as the identity of the caller, or data relating to the execution context, such as additonal details about the runtime environment.

A provider may declare these inputs freely, specifying them as parameters of the body function. It will then be the responsibility of the module and the runtime to provide all the data required by all providers.

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

In this example the `authProvider` needs an optional `token` as input, validates it and returns an optional user ID as an additional input for functions that need it.

## Usage

To use one or more providers, you must pass them to the function implementation.

```typescript
const readPosts = readPostDefinition
  // highlight-start
  .use({ providers: { prisma: prismaProvider } })
  // highlight-end
  .implement({
    // highlight-start
    async body({ input, prisma }) {
    // highlight-end
      const posts = // retrieve posts using the prisma client
      return result.ok(posts)
    },
  })
```

Thanks to Mondrian's typing engine, the input parameter to the body function is enriched with the object returned by each provider so that there is strict typing between the declared providers and the resources that can be used in the implementation.

A provider can be shared by several functions, it is typical that it be so. It is **invoked at each execution** of each function that declares its use. This is important and to be considered when deciding how to construct the resources returned by it. If you wish to define a provider that works as a singleton, i.e. an identical object for each execution of each function, simply implement it as in the first example in this page.

## Dependency

A provider may also depend on another providers, thus forming chains of providers. In this way, useful logic can be reused for a set of functions, but also for other providers, without duplication of code.

Similar to what you can do for a function, you can declare a dependency between providers using the `use` method. In this case, the data provided by the parent provider are accessible as part of a second parameter of the `body` function.

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
      const audit = ...
      return result.ok(audit)
    },
})
```

## Errors

A provider may also declare the possibility of returning errors, in the same formalism as a function. And, obviously, it can return them in the body implementation using the `result.fail` utility function.

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
The errors returned by a provider must also be present in the **declaration of each of the function** that use it. Indeed, at each invocation, these errors may be generated in the execution of the provider, and are automatically returned by the function, which must then declare them in order to produce a consistent specification.
:::
