# Implementation

The implementation of a module primarily involves combining the implementations of its functions
with the business logic required to build the context that satisfies the functions' requirements (e.g., providing resources from providers).

In Mondrian, a module is implemented by starting with its [definition](./01-definition.md) and
invoking the `implement` method on it.

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

Each function within a module can depend on a number of [providers](../function/03-provider.md) to fulfill its application logic. Examples include needing a reference to a repository to interact with a data source, or a client to enqueue jobs in a queue.

When implementing a module, you must provide a `context` builder function capable of supplying all the resources requested by all the providers used by all the functions within that module. This constraint is enforced by the framework at the TypeScript level, minimizing the risk of runtime errors due to missing context.

The context builder function itself is defined within the `implement` call:

```ts showLineNumbers
import { module } from '@mondrian-framework/module' // Assuming imports
import { result } from '@mondrian-framework/model'
import { Respository, Queue } from './dependencies' // Placeholder types
import { moduleDefinition, firstFunctionDefinition, secondFunctionDefinition } from './definitions' // Placeholder definitions

// Define functions and their context requirements (simplified)
type FirstFunctionContext = { repository: Respository }
const firstFunction = firstFunctionDefinition.implement({
  async body({ /* ... other args ..., */ context }) {
    // context is of type FirstFunctionContext
    const data = await context.repository.find()
    return result.ok(data)
  },
})

type SecondFunctionContext = { queue: Queue }
const secondFunction = secondFunctionDefinition.implement({
  async body({ /* ... other args ..., */ context }) {
    // context is of type SecondFunctionContext
    await context.queue.enqueue({ task: 'process' })
    return result.ok()
  },
})

// Implement the module, providing the context builder
const moduleImplementation = moduleDefinition.implement({
  functions: {
    firstFunction,
    secondFunction,
  },
  // highlight-start
  // This function must build a context satisfying ALL function needs
  context: async () => {
    // Initialize or retrieve dependencies
    const repository = new Respository(/* ... */)
    const queue = new Queue(/* ... */)

    // Return an object containing all required context properties
    // The framework checks that { repository: Respository; queue: Queue } is assignable
    // to FirstFunctionContext & SecondFunctionContext
    return result.ok({
      repository,
      queue,
    })
  },
  // highlight-end
})
```

The context builder function (`context: async (...) => ...`) constructs the necessary context. It can optionally receive input itself, declared as its first parameter type. This input is provided by the specific [Runtime](../runtime/index.md) executing the module. The runtime is responsible for translating external request details (e.g., HTTP headers, authentication tokens) into the input expected by the module's context builder.

```ts showLineNumbers
import { module } from '@mondrian-framework/module' // Assuming imports
import { result } from '@mondrian-framework/model'
import { moduleDefinition } from './definitions' // Placeholder definition

// Define the input type expected by the context builder from the runtime
type ContextInput = { authorizationHeader?: string; traceId?: string }

const moduleImplementation = moduleDefinition.implement({
  functions: { /* ... function implementations ... */ },
  // highlight-start
  context: async (runtimeInput: ContextInput) => {
    // Use the runtimeInput to build the context for the functions
    const userId = await getUserIdFromToken(runtimeInput.authorizationHeader)
    // ... build other context parts ...
    return result.ok({
      userId,
      traceId: runtimeInput.traceId,
      // ... other context properties
    })
  },
  // highlight-end
})

declare function getUserIdFromToken(token: string | undefined): Promise<string | undefined>; // Placeholder
```

Context creation thus forms a chain where each component has specific responsibilities:

&nbsp;
![Context](/img/context.png)

- The **Runtime** interprets the caller's request (e.g., HTTP, GraphQL query) and extracts the necessary data to form the input for the module's context builder, hiding execution environment details.
- The **Module's Context Builder** processes the input from the runtime to create the specific context object required by its functions and their providers.
- The **Function** receives and uses this context object (along with its direct input) to execute its application logic.

:::warning
The module's context creation logic (`context: async (...) => ...`) is **invoked for each function execution**. Modules themselves do not maintain a permanent state between invocations. Therefore, be mindful of the performance implications of this operation, especially regarding resource initialization (like database connections) and external calls made during context building.
:::

## Errors

As mentioned in the [module definition](./01-definition.md) section, the context creation process itself can fail and return errors. These errors must be declared in the module's definition.

```ts showLineNumbers
import { module, error } from '@mondrian-framework/module' // Assuming imports
import { result, model } from '@mondrian-framework/model'

// Define potential context errors
const moduleErrors = error.define({
  invalidCredentials: { message: 'Given credentials are not valid' },
  unauthorizedError: { message: 'Unauthorized access' },
})

// Define the module with declared errors
const moduleDefinition = module.define({
  name: 'secure-module',
  functions: { /* ... function definitions ... */ },
  errors: moduleErrors,
})

declare function isAuthorized(creds: unknown): boolean; // Placeholder

const moduleImplementation = moduleDefinition.implement({
  functions: { /* ... function implementations ... */ },
  context: async (runtimeInput: { credentials?: unknown }) => {
    // highlight-start
    if (!runtimeInput.credentials) {
      // Use the key from the defined moduleErrors
      return result.fail({ invalidCredentials: {} })
    }
    if (!isAuthorized(runtimeInput.credentials)) {
      // Use the key from the defined moduleErrors
      return result.fail({ unauthorizedError: {} })
    }
    // highlight-end
    // If checks pass, build and return the successful context
    return result.ok({
      /* ... context properties ... */
    })
  },
})
```

## Security Policies

The ability to serve APIs that expose portions of the domain graph (via `retrieve` capabilities) makes securing data access a complex but crucial task. This is particularly relevant in GraphQL but also applies generally when backend APIs allow flexible data retrieval.

Mondrian provides a security framework to address this by allowing you to define resource access policies.

```ts showLineNumbers
import { module } from '@mondrian-framework/module' // Assuming imports
import { policies } from './security-policies' // Assuming policies are defined elsewhere
import { moduleDefinition } from './definitions' // Placeholder definition

const moduleImplementation = moduleDefinition.implement({
  functions: { /* ... function implementations ... */ },
  context: async (/*...*/) => { /* ... context builder ... */ },
  // highlight-start
  policies(context) {
    // The context object built by the 'context' function above is passed here
    if (context.userId != null) {
      // Return policies suitable for an authenticated user
      return policies.loggedUser(context.userId)
    } else {
      // Return policies suitable for a guest
      return policies.guest
    }
  },
  // highlight-end
})
```

As shown, the optional `policies` function within `implement` receives the generated module context as input. Based on this context (e.g., user authentication status), it returns a set of security policy rules. The framework uses these rules to authorize data access during function execution, particularly for functions using `retrieve`. User-defined security policies determine precisely which resources and fields the caller is allowed to access.

To explore this topic further, please refer to the [Security Policies guide](../../guides/01-security.md).

## Options

Every module implementation accepts several options to customize its runtime behavior.

```ts showLineNumbers
import { module } from '@mondrian-framework/module' // Assuming imports
import { moduleDefinition } from './definitions' // Placeholder definition

const moduleImplementation = moduleDefinition.implement({
  functions: { /* ... function implementations ... */ },
  context: async (/*...*/) => { /* ... context builder ... */ },
  // highlight-start
  options: {
    checkOutputType: 'log', // Default: 'throw'
    maxSelectionDepth: 5, // Default: undefined (no limit)
    opentelemetry: true, // Default: true
  },
  // highlight-end
})
```

Specifying options is not mandatory, and each has a default value:

- `checkOutputType`: Controls runtime checks on function output values.
  - `'throw'` (Default): Throws an error if a function's return value doesn't conform to its defined output type or violates selection constraints.
  - `'log'`: Performs the check and logs failures as errors but does not throw, allowing execution to continue.
  - `'ignore'`: Skips the output type check entirely (potentially improving performance in production, but use with caution).

- `maxSelectionDepth`: Sets the maximum depth allowed for nested selections in `retrieve` operations. If a request exceeds this depth, an error is thrown. The default is `undefined` (no depth limit). Setting a reasonable limit (e.g., 5 or 10) in production is recommended to help prevent denial-of-service attacks via overly complex queries.

- `opentelemetry`: Enables or disables OpenTelemetry instrumentation for the module's functions. Default is `true` (enabled if OpenTelemetry is configured). This is used for distributed tracing and monitoring. See the [Tracing guide](../../guides/06-tracing.md) for more details.
