# GraphQL

This runtime allows a Mondrian module to be served as a GraphQL API. It automatically generates a GraphQL schema based on the module's functions and underlying model types, and provides resolvers that execute the corresponding function logic.

## Package

To use this runtime, you need to install the `@mondrian-framework/graphql-yoga` dependency. This package provides the necessary tools to build and serve the GraphQL API.

```ts showLineNumbers
import { graphql } from '@mondrian-framework/graphql-yoga'
// or import { serveWithFastify } from '@mondrian-framework/graphql-yoga' for the server adapter
```

This package leverages [GraphQL Yoga](https://the-guild.dev/graphql/yoga-server), a popular and fully-featured GraphQL server library.

## Definition

Similar to the REST runtime, you first define an API component using the `build` function provided by the `graphql` namespace. This function primarily requires the implemented Mondrian module you want to expose and configuration for how its functions map to GraphQL operations.

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

## Functions Mapping (`graphql.build`)

When building the GraphQL API using `graphql.build`, you must specify how each function from the module should be exposed in the GraphQL schema. This is done via the `functions` field in the configuration object.

For each module function you want to expose, provide an entry in the `functions` object. The key should be the function name (as defined in the module), and the value should be an object specifying its GraphQL operation type:

- `{ type: 'query' }`: Exposes the function as a field under the `Query` type in the GraphQL schema.
- `{ type: 'mutation' }`: Exposes the function as a field under the `Mutation` type in the GraphQL schema.

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

The input, output, and error types defined in the Mondrian function definitions are automatically translated into corresponding GraphQL types (Input Objects, Object Types, Unions, Enums, Scalars). Functions utilizing `retrieve` capabilities are translated into queries or mutations that accept arguments for filtering (`where`), sorting (`orderBy`), pagination (`skip`, `take`), and field selection (GraphQL selections), matching the capabilities enabled in the function definition.

## Serving (with Fastify)

To serve the defined GraphQL API, you can use integration adapters provided by `@mondrian-framework/graphql-yoga`, such as `serveWithFastify` for use with the Fastify web server.

This function takes the Fastify server instance, the GraphQL API definition created by `graphql.build`, a context builder function specific to the server environment, and optional server configuration options.

```ts showLineNumbers
// Assuming imports for graphql, serveWithFastify, fastify, myModule, etc.

// highlight-start
// ... (graphql.build definition as above)

const server = fastify()

serveWithFastify({
  server, // The Fastify server instance
  api,    // The GraphQL API definition from graphql.build
  context: async ({ request }) => {
    // Build the context required by the module.
    // This function receives the Fastify request object.
    // It must return the input expected by myModule's context builder.
    const authorization = request.headers.authorization
    // ... potentially validate token, fetch user details ...
    return { authorization /* ... other context properties ... */ }
  },
  options: {
    // Server-specific options passed to GraphQL Yoga
    // Enable GraphQL Playground/GraphiQL interface via introspection
    introspection: true,
    // endpoint: '/my-graphql-path' // Configure the endpoint path (defaults to /graphql)
  },
})

server.listen({ port: 4000 }).then((address) => {
  console.log(`GraphQL server started at ${address}/graphql`)
})
// highlight-end
```

### Context

The `context` function provided to `serveWithFastify` is crucial. It's executed for each incoming GraphQL request and is responsible for creating the context object required by your Mondrian module's own context builder. This is where you typically handle tasks like extracting authentication details from headers, setting up database connections per request, or gathering other request-specific information. The return value of this function becomes the input to your module's `context` function.

### Options

The `serveWithFastify` function accepts an `options` object, which is passed down to configure the underlying GraphQL Yoga server. Key options include:

- `introspection`: Set to `true` (default) to enable schema introspection. This allows tools like GraphQL Playground or GraphiQL to fetch the schema and provide an interactive API explorer at the GraphQL endpoint.
- `endpoint`: A string specifying the URL path for the GraphQL API (defaults to `/graphql`).
- Other GraphQL Yoga server options can be included here as needed (refer to the GraphQL Yoga documentation).

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
  functions: {
    getUser: { type: 'query' },
    createUser: { type: 'mutation' },
  },
})

// 5. Serve the API
const server = fastify()

serveWithFastify({
  server,
  api: graphQLApi,
  context: async ({ request }) => {
    // Example context builder for the server adapter
    // This needs to return the input expected by userModule's context builder (if any)
    // For this simple example, the module doesn't need context, so we return {}
    return {}
  },
  options: {
    introspection: true, // Enable GraphQL Playground
    // endpoint: '/graphql' // Default endpoint
  },
})

server.listen({ port: 4000 }).then((address) => {
  console.log(`GraphQL server running at ${address}/graphql`)
})
```

Now you can access `http://localhost:4000/graphql` (or your configured `endpoint`) in your browser to use the GraphQL Playground and interact with your API.
