# Clients (SDKs)

Mondrian Framework enables the automatic generation of type-safe clients (or SDKs) directly from your module definitions and API specifications. This powerful feature allows you to interact with your functions programmatically, either directly within your backend for testing or integration purposes, or from external applications (like frontends) interacting with your deployed APIs.

There are two primary types of clients:

1.  **Module Client**: Interacts directly with a module's implementation, bypassing network layers. Ideal for testing and server-to-server communication within the same process.
2.  **REST Client**: Interacts with a Mondrian module exposed as a REST API over HTTP. Ideal for frontend applications or external services consuming your API.

## Module Client (`import { client } from '@mondrian-framework/module'`)

The Module Client provides a way to call the functions of an implemented Mondrian module directly in TypeScript, without needing to run an HTTP server.

**Key Features:**

- **Full Type Safety**: Calls are type-checked against the function definitions, including input types, output types, potential errors, and even the shape of the returned data based on the `retrieve` options (projection).
- **Direct Execution**: Bypasses network requests, making it very fast and suitable for integration or end-to-end tests.
- **Dependency Injection**: Requires a `context` builder, allowing you to inject mock dependencies or test-specific configurations easily.
- **Metadata Support**: Allows passing arbitrary metadata to the context builder for each call using `withMetadata`.

### Building the Module Client

You build a Module Client instance from an _implemented_ Mondrian module (`module.implement(...)`). You also need to provide a `context` builder function that simulates how a runtime would create the context required by the module's functions and providers.

```ts showLineNumbers
// client-setup.ts
import { myModuleImplementation } from '../src/module'
import { result } from '@mondrian-framework/model'
// Your implemented module
import { client } from '@mondrian-framework/module'

// Define a context builder function for the client
// This example assumes the module needs a 'dbClient' and might use metadata
async function buildClientContext(args: { metadata?: { traceId?: string } }) {
  console.log('Building context with traceId:', args.metadata?.traceId)
  const mockDbClient = {
    /* ... mock db client methods ... */
  }
  // Return the context structure expected by your module implementation
  return result.ok({ dbClient: mockDbClient })
}

// Build the client instance
export const moduleClient = client.build({
  module: myModuleImplementation,
  context: buildClientContext,
})

// Example of using metadata
export const clientWithMetadata = moduleClient.withMetadata({ traceId: 'xyz-789' })
```

### Using the Module Client

Once built, you can call functions directly via the `functions` property. The arguments and return types are fully typed.

```ts showLineNumbers
// user.test.ts
import { moduleClient } from './client-setup'
import { describe, it, expect } from 'vitest'

describe('User Module Client Tests', () => {
  it('should get user details with specific fields', async () => {
    // Assumes a 'getUser' function exists in the module
    const userResult = await moduleClient.functions.getUser(
      { id: 'user-123' }, // Input
      {
        // Retrieve options: Select only id and email
        retrieve: {
          select: { id: true, email: true },
        },
      },
    )

    expect(userResult.isOk).toBe(true)
    if (userResult.isOk) {
      // userResult.value is typed as { readonly id: string; readonly email: string }
      // Accessing userResult.value.name would be a compile-time error
      expect(userResult.value).toHaveProperty('id')
      expect(userResult.value).toHaveProperty('email')
      expect(userResult.value).not.toHaveProperty('name')
    }
  })
  // ... other tests
})
```

For more details on using the Module Client for testing, see the [Testing Guide](./03-testing.md).

## REST Client (`import { client } from '@mondrian-framework/rest'`)

The REST Client allows you to interact with a Mondrian module that has been exposed via the REST runtime (`@mondrian-framework/rest-fastify` or similar). It makes actual HTTP requests to the specified endpoint based on the REST API specification.

**Key Features:**

- **Type Safety**: Provides type checking for function inputs and outputs based on the Mondrian function definitions and the REST API specification.
- **HTTP Interaction**: Handles the underlying `fetch` calls, request body formatting, query parameter encoding, and response parsing.
- **REST Mapping Awareness**: Understands how functions, inputs, and outputs are mapped to HTTP methods, paths, query parameters, and request/response bodies according to the `rest.build` configuration.
- **Header Customization**: Allows setting custom HTTP headers for all requests using `withHeaders`.

### Building the REST Client

You build a REST Client using the `build` function from `@mondrian-framework/rest/client`. It requires the **endpoint URL** of the deployed REST API and the **API specification object** generated by `rest.build`.

```ts showLineNumbers
// rest-client-setup.ts
import { restApiSpecification } from '../src/api/rest'
// The result of rest.build(...)
import { client } from '@mondrian-framework/rest'

const API_ENDPOINT = 'http://localhost:4000' // Base URL of your running API

// Build the basic client
export const restClient = client.build({
  endpoint: API_ENDPOINT,
  rest: restApiSpecification, // Provide the API specification object
})

// Build a client with custom headers (e.g., for authentication)
export const authenticatedRestClient = restClient.withHeaders({
  Authorization: 'Bearer your-jwt-token',
})
```

### Using the REST Client

Interacting with the REST client is similar to the Module Client, calling functions via the `functions` property. The client handles the HTTP request details automatically based on the provided API specification.

```ts showLineNumbers
// api-consumer.ts
import { restClient } from './rest-client-setup'

async function fetchUserDetails(userId: string) {
  try {
    // Assumes a 'getUser' function mapped in the REST API
    const userResult = await restClient.functions.getUser(
      { id: userId },
      {
        retrieve: {
          // Retrieve only specific fields (mapped to query params for GET)
          select: { name: true, posts: { select: { title: true } } },
        },
      },
    )

    if (userResult.isOk) {
      console.log('User Name:', userResult.value.name)
      // userResult.value type is projected based on select
      console.log(
        'Post Titles:',
        userResult.value.posts?.map((p) => p.title),
      )
    } else {
      // Handle potential defined errors (e.g., userNotFound)
      if (userResult.error.userNotFound) {
        console.error('User not found:', userResult.error.userNotFound.message)
      } else {
        console.error('An unexpected error occurred:', userResult.error)
      }
    }
  } catch (error) {
    // Handle network errors or unexpected server errors
    console.error('Failed to fetch user:', error)
  }
}

fetchUserDetails('user-456')
```

## Client Generation for Decoupling

A significant advantage of Mondrian's client system is that you **do not need the full backend implementation** to create a functional client, especially for the REST Client.

You can share:

1.  The **Module Interface** (`module.define(...)` result) or just the relevant **Function Interfaces** (`functions.define(...)` results).
2.  The **REST API Specification** (`rest.define(...)` result).

With just these two pieces of information (which define the _contract_ of the API), a separate team (e.g., frontend) can use `import { client } from '@mondrian-framework/rest'` to build a fully type-safe client to interact with the API endpoint.

This promotes strong decoupling:

- Frontend teams can develop against a type-safe contract without waiting for the backend implementation to be complete.
- Changes to the backend implementation details won't break the client as long as the function and REST API contracts are maintained.
- Type safety reduces integration errors between frontend and backend.

This makes Mondrian clients a powerful tool for building robust, maintainable, and scalable applications with clear boundaries between services and consumers.
