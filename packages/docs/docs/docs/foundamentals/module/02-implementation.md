# Implementation

The implementation of a module is basically the union of the implementations of its functions
and the business logic to give them a context that satisfies their requirements.

In Mondrian, a module is implemented by starting with its [definition](./01-definition.md) and
invoking the `implement` method.

```ts showLineNumbers
import { retrievePosts, createPost, updatePost, deletePost } from '../post-functions'
import { postModuleDefinition } from './definitions'
import { result } from '@mondrian-framework/model'
import { module } from '@mondrian-framework/module'

const postModule = postModuleDefinition.implement({
  functions: {
    retrievePosts,
    createPost,
    updatePost,
    deletePost,
  },
  context: async () => {
    return result.ok({
      // a context definition
    })
  },
})
```

## Context

Each function can require a number of [providers](../function/03-provider.md) in order to fulfill its application logic. As an example a reference to a repository to interact with a data source, or a queue where to put some jobs to be completed.

While serving a module we must provide all the information requested by all the providers defined in all function. This constraint is enforced by the framework at typing level so there are no risk to fall in mistake.

Let's go with an example:

```ts showLineNumbers
// ...

type FirstFunctionContext = {
  repository: Respository
}
const firstFunction = fistFunctionDefinition.implement<FirstFunctionContext>({
  body: async ({ context }) => {
    // context is of type FirstFunctionContext
    // ...
  },
})

type SecondFunctionContext = {
  queue: Queue
}
const secondFunction = secondFunctionDefinition.implement<SecondFunctionContext>({
  body: async ({ context }) => {
    // context is of type SecondFunctionContext
    // ...
  },
})

const module = moduleDefinition.implement({
  functions: {
    firstFunction,
    secondFunction,
  },
  context: async () => {
    // must return an object of type FirstFunctionContext & SecondFunctionContext
    return result.ok({
      repository,
      queue,
    })
  },
})
```

The output context is constructed by the module from an input that the module itself can declare, at the typing level, as the function's first parameter. It will then be the runtimes that execute this module that will have to worry about providing this input.

```ts showLineNumbers
...
const moduleImplementation = moduleDefinition
  .implement({
    // ...
    context: async (input: ContextInput) => {
      // use the input to build the context for the functions
      return result.ok({
        // a context definition
      })
    },
  })
```

That of context is thus a chain of processing in which each step fulfills its own responsibilities:

&nbsp;
![Context](/img/context.png)

- the **runtime** is responsible for interpreting the caller's request, since it knows its format, and extrapolating from it the data needed for the form, hiding all the technicalities of the execution environment.
- the **module** is responsible for processing these inputs from the runtime to create the context required by its functions
- the **function** uses the context to carry out its application logic

:::warning
Context creation is an operation that is **invoked at each function execution**; in fact, the module does not have its own permanent state. Therefore, care must be taken with this operation and the implications it may have on performance, connection management, etc.
:::

## Errors

Note that, as described in the [module definition](./01-definition.md), context creation can also return errors.

```ts showLineNumbers
// ...

const moduleDefinition = module.define({
  // ...
  // highlight-start
  errors: {
    invalidCredentials: model.string(),
    unauthorizedError: model.string(),
  },
  // highlight-end
})

const moduleImplementation = module.implement({
  // ...
  context: async ({ credentials }: { credentials: Credentials }) => {
    // highlight-start
    if (!credentials) {
      return result.fail({ invalidCredentials: 'Given credentials are not valid' })
    }
    if (!isAuthorized(credentials)) {
      return result.fail({ unauthorizedError: 'Unauthorized access' })
    }
    // highlight-end
    result.ok({
      // ...
    })
  },
})
```

## Security Policies

The ability to serve APIs that can provide a portion of the domain graph makes the problem of securing data quite complex to manage. This is a typical issue in GraphQL contexts, but also quite common in general when the backend serves dynamic APIs that can satisfy complex data retrieval requests.

To solve this issue, Mondrian offers a ready-to-use security framework that allows you to define resource access policies in a simple but very powerful way.

```ts showLineNumbers
const moduleImplementation = moduleDefinition.implement({
  // ...
  policies(context) {
    if (context.userId != null) {
      return policies.loggedUser(context.userId)
    } else {
      return policies.guest
    }
  },
})
```

As you can see from the example, the `policies` function receives as input the module context and, based on it, returns a security policy that will then allow the framework to determine whether or not the call is authorized. Security policies are user-defined and determine what resources the caller may or may not access.

To further explore this topic you will find all the details in the section on [security policies](../../guides/01-security.md).

## Options

Every module implementation accepts several options that can be used to customize its behavior.

```ts showLineNumbers
const moduleImplementation = moduleDefinition.implement({
  // ...
  options: {
    checkOutputType: 'log',
    maxSelectionDepth: 3,
    opentelemetry: true,
  },
})
```

Options specifications is not mandatory and each one has a default value:

- `checkOutputType`: checks (at runtime) if the output value of any function is valid, it also checks if the eventual selection is respected. Default is `throw`, so if the check fails an error is thrown. You can also set it to `log` to do the check and just log failures, but without returning an error. With `ignore` the check is skipped (could be useful in a production environment in order to improve performance).

- `maxSelectionDepth`: maximum selection depth allowed in a request. If the requested selection is deeper than this value an error is thrown. The default is any depth, but in production it is suggested to set a limit (like 5) in order to prevent denial of service attacks.

- `opentelemetry`: enables opentelemetry instrumentation, this can be useful for tracing and monitoring the performance of your application. You can find more details about tracing in the [dedicated section](../../guides/05-logging.md).
