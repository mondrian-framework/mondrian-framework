# Provider

Quite often the implementation of a function requires data, connections, or more generally resources, that do not depend on an input but on the context in which it is executed. To inject these dependencies within a function and be able to use them for the development of application logic, Mondrian provides the provider construct.

## Definition
To define a provider, the module of the same name is made available in the `@mondrian-framework/module package`. Below is an example of a provider of the singleton instance of [Prisma](https://www.prisma.io/), a well-known TypeScript ORM.

```typescript
import { result } from '@mondrian-framework/model'
import { provider } from '@mondrian-framework/module'
import { PrismaClient } from '@prisma/client'

const prismaSingleton = new PrismaClient()
export const prismaProvider = provider.build({
  body: async () => {
    return result.ok({ prisma: prismaSingleton })
  },
})
```

Note that the provider is very similar to a function but does not need the definition of input and output as they have no impact at the definition level but only at the implementation level.

## Usage
To use one or more providers, you must pass them to the function implementation.

```typescript
const readPosts = readPostDefinition
  .use({ providers: { prisma: prismaProvider } })
  .implement({
    async body({ input, prisma }) {
      const posts = // retrieve posts using the prisma client
      return result.ok(posts)
    },
  })
```
Thanks to Mondrian's typing engine, the input parameter to the body function is enriched with the object returned by each provider so that there is close typing between the declared providers and the resources that can be used in the implementation.

A provider can clearly be shared by several functions, it is typical that it be so. It is **invoked at each execution** of each function that declares its use. This is important and to be considered when deciding how to construct the resources returned by it.

If you wish to define a provider that returns a singleton, i.e. an identical object for each execution of each function, simply implement it as in the example above.

## Dependency

A provider may also depend on another provider, thus forming chains of providers. In this way, useful logic can be reused for a set of functions, but also for other providers without duplication of code.


## Error

