# Mocking

Mondrian Framework provides a convenient way to create mock implementations for your functions directly from their definitions. This is particularly useful during development, especially when building APIs where the backend logic might not be fully implemented, but you need a functional endpoint for frontend development or API contract validation.

## Mocking a Function

Every function definition created using `functions.define` automatically includes a `.mock()` method. Calling this method generates a fully functional, albeit mocked, implementation of that function.

This mocked implementation adheres to the defined input, output, and error types. It generates example data for successful responses based on the output type's structure and can simulate errors based on the defined error types.

```ts showLineNumbers
import { serveWithFastify, graphql } from '@mondrian-framework/graphql-yoga'
import { model, result } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'
import { fastify } from 'fastify'

// 1. Define the function interface
const getUserDefinition = functions.define({
  input: model.object({ userId: model.string() }),
  output: model.object({ id: model.string(), name: model.string(), email: model.email() }).nullable(),
  errors: {
    userNotFound: { message: 'User not found' },
  },
})

// 2. Create a mock implementation
// highlight-start
const getUserMock = getUserDefinition.mock({
  errorProbability: 0.1, // 10% chance of returning an error
  maxDepth: 2, // Generate example data up to 2 levels deep
})
// highlight-end

// 3. Use the mock implementation in a module
const userModule = module.build({
  name: 'user-mocks',
  functions: {
    // highlight-next-line
    getUser: getUserMock, // Use the mocked function
  },
})

// 4. Serve the module (Example with GraphQL)
const graphQLApi = graphql.build({
  module: userModule,
  functions: {
    getUser: { type: 'query' },
  },
})

const server = fastify()
serveWithFastify({
  server,
  api: graphQLApi,
  context: async () => ({}), // Mock context
  options: { introspection: true },
})

server.listen({ port: 4000 }).then((address) => {
  console.log(`Mock GraphQL server running at ${address}/graphql`)
  console.log('Try query { getUser(userId: "1") { id name email } }')
  console.log(
    'Or query { getUser(userId: "non-existent") { ... on UserNotFound { message } } } (might take a few tries for error)',
  )
})
```

## Mocking Options

The `.mock()` method accepts an optional configuration object:

- `errorProbability` (number, 0 to 1): Specifies the likelihood that the mock function will return one of its defined errors instead of a successful response. Defaults to `0`.
- `maxDepth` (number): Controls how deeply nested the example data generated for the output type should be. This is useful for complex object structures or recursive types. Defaults to `1`. Be cautious with large values, as this can impact performance for types with many arrays.

## Use Cases

- **API Prototyping**: Quickly stand up API endpoints based on defined contracts without writing backend logic.
- **Frontend Development**: Allow frontend teams to develop against a working API that returns realistic (though randomized) data structures.
- **Contract Testing**: Verify that clients can interact correctly with the API structure before the full implementation is available.
- **Component Isolation**: When testing a module that depends on another, you can provide mocked implementations for the dependency's functions.

By leveraging the `.mock()` functionality, you can significantly speed up development workflows and improve collaboration between frontend and backend teams by providing immediate, contract-compliant mock APIs.
