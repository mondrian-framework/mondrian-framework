# Testing

Mondrian Framework is designed with testability in mind. One key enabler for robust testing, especially for end-to-end (E2E) style tests, is the Mondrian Client.

## Mondrian Client for Testing

The Mondrian Client (`@mondrian-framework/module/client`) allows you to interact with your implemented Mondrian module directly in your test environment, bypassing the need for HTTP servers or network requests. This offers several advantages:

- **Type Safety**: Client calls are fully type-checked against your function definitions, including inputs, outputs, errors, and retrieve capabilities. The return types are projected based on the `select` clause you provide, catching integration errors at compile time.
- **Speed**: Executing functions directly is significantly faster than going through network layers, leading to quicker test runs.
- **Isolation**: You can easily mock dependencies within the client's context builder, isolating your module logic for focused testing.
- **Simplicity**: For many test scenarios, it avoids the complexity of setting up and tearing down servers or managing test databases across network boundaries.

## Building the Client

You build a client instance directly from your implemented module. The core requirement is to provide a `context` builder function that simulates how a real runtime generates the context for your functions. In a testing scenario, this function is where you inject mocks or test-specific configurations.

```ts showLineNumbers
// test-setup.ts
import { myModuleImplementation } from '../src/module'
import { module, client } from '@mondrian-framework/module'

// Assuming your implemented module is here

// highlight-start
// Define the context builder for the test environment
async function buildTestContext(args: { metadata?: unknown }) {
  // ...
}

// Build the client instance
export const testClient = client.build({
  module: myModuleImplementation,
  context: buildTestContext,
})
// highlight-end
```

## Writing Tests

With the client set up, you can import it into your test files (e.g., using Vitest, Jest) and call functions as if you were interacting with the real API, but with the benefit of full type safety and direct execution.

```ts showLineNumbers
// user.test.ts
import { testClient } from './test-setup'
import { result } from '@mondrian-framework/model'
import { describe, it, expect } from 'vitest'

describe('User Module Tests', () => {
  it('should retrieve specific user fields using the client', async () => {
    // highlight-start
    // Call the 'getUser' function via the test client
    const userResult = await testClient.functions.getUser(
      { id: '1' }, // Input for the getUser function
      {
        // Retrieve options
        retrieve: {
          select: {
            id: true,
            name: true,
            // email: true, // If email was requested, it would be type-checked
          },
        },
      },
    )
    // highlight-end

    // Assert the result (assuming getUser returns result.Result)
    expect(userResult.isOk).toBe(true)

    if (userResult.isOk) {
      // The type of userResult.value is correctly inferred based on the 'select'
      // It will be { readonly id: string; readonly name: string }
      expect(userResult.value).toEqual({ id: '1', name: 'Alice (Mock)' })
      // expect(userResult.value.email).toBeUndefined(); // Type error if uncommented!
    }
  })

  it('should handle function errors', async () => {
    // Assuming createUser can fail with 'emailTaken'
    const creationResult = await testClient.functions.createUser({
      name: 'Charlie',
      email: 'existing@example.com', // Assume this email triggers the mock error
    })

    expect(creationResult.isOk).toBe(false)
    if (!creationResult.isOk) {
      // Type-safe access to potential errors
      expect(creationResult.error.emailTaken?.message).toEqual('Email is already taken.')
    }
  })

  // Add more tests for different functions, inputs, retrieves, and error cases
})
```

By leveraging the Mondrian Client, you can write comprehensive and reliable tests that verify your module's logic and its integrations with dependencies in a controlled, type-safe, and efficient manner. Remember to consult the specific documentation for `client.build` and the `client` types in `@mondrian-framework/module/client` for more advanced usage patterns.
