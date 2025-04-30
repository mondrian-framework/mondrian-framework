# Versioning

As APIs evolve, managing changes without breaking existing clients becomes crucial. Mondrian Framework supports API versioning, particularly for REST endpoints, allowing you to introduce changes gradually or maintain multiple versions concurrently.

## REST API Versioning

The `@mondrian-framework/rest` runtime offers built-in support for API versioning.

### Module Version

You define a primary version for your entire REST API when building it using `rest.build`. This version number is reflected in the base path of the API (e.g., `/api/v2`).

```ts showLineNumbers
// api.ts
import { module } from '../src/module'
// Assuming your module is defined here
import { rest } from '@mondrian-framework/rest'

const api = rest.build({
  module: module,
  // highlight-start
  version: 2, // Defines the base version for this API deployment
  // highlight-end
  functions: {
    // ... function mappings
  },
  // ... other config
})
```

When served (e.g., using `@mondrian-framework/rest-fastify`), the runtime typically prefixes all routes with `/api/v{version}`. In this case, endpoints would be under `/api/v2`.

### Function Versioning

You can also specify version constraints for individual function mappings. This allows specific endpoints to exist only within certain version ranges. Use the `version` option within the function mapping object, specifying `min` and/or `max` versions.

```ts showLineNumbers
// api.ts
import { module } from '../src/module'
import { rest } from '@mondrian-framework/rest'

const api = rest.build({
  module: module,
  version: 2, // Base API version
  functions: {
    // highlight-start
    register: [
      // This mapping is active only for version 2 and above
      { method: 'post', path: '/subscribe', version: { min: 2 } },
      // This mapping was active only up to version 1
      { method: 'put', path: '/user', version: { max: 1 } },
    ],
    // highlight-end
    login: { method: 'post', path: '/login' }, // Active for all versions of this deployment (v2)
    // ... other functions
  },
  // ... other config
})
```

In this example, the API will be deployed supporting `v1` and `v2` routes based on these mappings:

- `POST /api/v2/subscribe` will map to the `register` function.
- `PUT /api/v1/user` will map to the `register` function (assuming the API was previously deployed as v1).
- `POST /api/v2/login` will map to the `login` function (as the base deployment is v2).
- If the API was also deployed as v1, `POST /api/v1/login` would also map to the `login` function.

This provides fine-grained control over endpoint availability across different API versions.

## GraphQL API Versioning

GraphQL takes a different approach to evolution compared to REST's explicit versioning. There isn't a built-in mechanism in the GraphQL specification or the `@mondrian-framework/graphql-yoga` runtime for versioned endpoints like `/graphql/v1` or `/graphql/v2`.

Typically, a single GraphQL endpoint exposes the **latest version** of the schema. Changes are managed through schema evolution:

1.  **Adding Fields/Types**: New fields or types can be added without breaking existing clients.
2.  **Deprecating Fields**: Fields that are no longer recommended can be marked as deprecated (`@deprecated` directive). Clients can gradually migrate away from deprecated fields.
3.  **Breaking Changes**: Removing or significantly altering existing fields is a breaking change and should be done cautiously, often coordinating with clients or potentially introducing a new, separate GraphQL API if the changes are substantial.

Therefore, when using Mondrian with GraphQL, the exposed API generally represents the current state of your module's functions and types. Versioning is handled implicitly by evolving the schema over time rather than through distinct versioned endpoints.
