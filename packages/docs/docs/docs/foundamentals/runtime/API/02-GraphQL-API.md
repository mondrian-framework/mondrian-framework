# GraphQL

This runtime allows a Mondrian module to be served as a GraphQL API. It automatically generates a GraphQL schema based on the module's functions and types, and provides resolvers to execute the corresponding function logic.

## Package

To use this runtime, you need to install the `@mondrian-framework/graphql-yoga` dependency and import the `graphql` namespace from it:

```ts showLineNumbers
import { graphql } from '@mondrian-framework/graphql-yoga'
```

This package builds upon [GraphQL Yoga](https://the-guild.dev/graphql/yoga-server), a popular and fully-featured GraphQL server.

## Definition

Similar to the REST runtime, you first define an API component using the `build` function provided by the `graphql` namespace. This function requires the Mondrian module you want to expose.

```ts showLineNumbers
import myModule from './my-module'
import { graphql } from '@mondrian-framework/graphql-yoga'

const api = graphql.build({
  module: myModule,
  // highlight-start
  functions: {
    // Function mapping configuration goes here
    getUser: { type: 'query' },
    createUser: { type: 'mutation' },
  },
  // highlight-end
})
```

## Functions

When building the GraphQL API, you need to specify how each function from the module should be exposed in the GraphQL schema. This is done via the `functions` field in the `graphql.build` configuration.

For each function you want to expose, provide an entry in the `functions` object where the key is the function name from the module, and the value is an object specifying its GraphQL type:

- `type: 'query'`: Exposes the function as a GraphQL query.
- `type: 'mutation'`: Exposes the function as a GraphQL mutation.

```ts showLineNumbers
// ... inside graphql.build
functions: {
  // highlight-start
  // Expose 'getUserById' function from the module as a GraphQL query
  getUserById: { type: 'query' },
  // Expose 'registerUser' function from the module as a GraphQL mutation
  registerUser: { type: 'mutation' },
  // 'updateUserProfile' function will be exposed as a mutation
  updateUserProfile: { type: 'mutation' },
  // Functions not listed here will not be exposed in the GraphQL API
  // highlight-end
}
// ...
```

The input, output, and error types defined in the Mondrian function definition are automatically translated into corresponding GraphQL types (Input Objects, Object Types, Unions, Enums, Scalars). Functions utilizing the `retrieve` capabilities are translated into queries that accept arguments for filtering, sorting, pagination, and field selection, matching the defined capabilities.

## Serving

To serve the defined GraphQL API, you can use integration packages like `@mondrian-framework/graphql-yoga`, which provides utilities for common Node.js servers like Fastify.

The `serveWithFastify` function takes the Fastify server instance, the built `api` definition, a context builder function, and optional server options.

```ts showLineNumbers
// highlight-end
import myModule from './my-module'
import { graphql } from '@mondrian-framework/graphql-yoga'
// highlight-start
import { serveWithFastify } from '@mondrian-framework/graphql-yoga'
import { fastify } from 'fastify'

// Assuming myModule is defined and implemented

const api = graphql.build({
  module: myModule,
  functions: {
    getUser: { type: 'query' },
    createUser: { type: 'mutation' },
  },
})

// highlight-start
const server = fastify()

// The context function receives request details and should return the context needed by the module/providers
serveWithFastify({
  server,
  api,
  context: async ({ request }) => {
    // Example: Extract auth token and build context
    const authorization = request.headers.get('authorization')
    // ... potentially validate token and fetch user details ...
    return { authorization /* ... other context fields */ }
  },
  options: {
    // Enable GraphQL Playground/GraphiQL interface
    introspection: true,
    // Configure the endpoint path (defaults to /graphql)
  },
})

server.listen({ port: 4000 }).then((address) => {
  console.log(`GraphQL server started at ${address}/graphql`)
})
// highlight-end
```

### Context

The `context` function is crucial. It's executed for each incoming GraphQL request and is responsible for creating the context object that will be passed down through the module and its providers. This is where you typically handle authentication, authorization, and database connection setup based on request headers or other details. The return value of this function must satisfy the context requirements of your Mondrian module implementation.

### Options

The `serveWithFastify` function accepts an `options` object, allowing you to configure the underlying GraphQL Yoga server. Key options include:

- `introspection`: Set to `true` (default) to enable schema introspection and tools like GraphQL Playground or GraphiQL, which provide an interactive API explorer at the GraphQL endpoint.
- `endpoint`: Specifies the URL path for the GraphQL API (defaults to `/graphql`).
- Other GraphQL Yoga options can be passed here as needed.

## Full Example

Here's a minimal complete example combining definition and serving:

```typescript showLineNumbers
import { graphql, serveWithFastify } from '@mondrian-framework/graphql-yoga'
import { model, result } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'
import { fastify } from 'fastify'

// 1. Define Model
const User = model.object({ id: model.string(), name: model.string() })
const CreateUserInput = model.object({ name: model.string() })

// 2. Define Functions
const getUser = functions
  .define({
    input: model.object({ id: model.string() }),
    output: model.optional(User),
  })
  .implement({
    async body({ input }) {
      // Dummy implementation
      if (input.id === '1') {
        return result.ok({ id: '1', name: 'Alice' })
      }
      return result.ok(undefined)
    },
  })

const createUser = functions
  .define({
    input: CreateUserInput,
    output: User,
  })
  .implement({
    async body({ input }) {
      // Dummy implementation
      const newUser = { id: String(Math.random()), name: input.name }
      return result.ok(newUser)
    },
  })

// 3. Define Module
const userModule = module.build({
  name: 'user',
  functions: { getUser, createUser },
})

// 4. Build GraphQL API definition
const graphQLApi = graphql.build({
  module: userModule,
  // highlight-start
  functions: {
    getUser: { type: 'query' },
    createUser: { type: 'mutation' },
  },
  // highlight-end
})

// 5. Serve the API
const server = fastify()

// highlight-start
serveWithFastify({
  server,
  api: graphQLApi,
  context: async ({ fastify: { request } }) => {
    // No context needed for this simple example
    return {}
  },
  options: {
    introspection: true, // Enable GraphQL Playground
  },
})
// highlight-end

server.listen({ port: 4000 }).then((address) => {
  console.log(`GraphQL server running at ${address}/graphql`)
})
```

Now you can access `http://localhost:4000/graphql` in your browser to use the GraphQL Playground and interact with your API.
