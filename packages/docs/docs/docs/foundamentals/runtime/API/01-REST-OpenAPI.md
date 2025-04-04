# REST (OpenAPI 3.1)

This runtime allows a Mondrian module to be served as a REST API conforming to the **OpenAPI 3.1** specification. Each function can be mapped as a REST service, whose inputs and outputs are configured as query parameters, path variables or raw body content.

The runtime, in addition to exposing a Web server for the API, provides a complete OpenAPI 3.1 specification automatically produced from the definition of the module model and functions.

## Package

To use this runtime you need to start adding the `@mondrian-framework/rest` dependency and import the `rest` namespace from it:

```ts showLineNumbers
import { rest } from '@mondrian-framework/rest'
```

## Definition

This runtime first requires the definition of a component typically called `api` and to do this it provides a `build` function that accepts the module and some runtime specific parameters.

```ts showLineNumbers
import myModule from './my-module'
import { rest } from '@mondrian-framework/rest'

// Assuming myModule is an implemented Mondrian Module

const api = rest.build({
  module: myModule,
  version: 2,
  functions: {
    //highlight-start
    // Example function mappings
    register: [
      // Multiple mappings for the same function
      { method: 'post', path: '/subscribe', version: { min: 2 } },
      { method: 'put', path: '/user', version: { max: 1 } },
    ],
    login: { method: 'post', path: '/login', errorCodes: { invalidLogin: 401 } },
    getUserPosts: { method: 'get', path: '/users/{userId}/posts' }, // Path parameters
    //highlight-end
  },
  // highlight-start
  // Other optional configurations
  securities: {
    // Define security schemes used by functions
    bearerAuth: { type: 'http', scheme: 'bearer' },
  },
  errorCodes: {
    // Default error code mappings
    unauthorized: 401,
    notFound: 404,
  },
  options: {
    // Global options for the API
    pathPrefix: '/api', // Prefix for all routes (e.g., /api/v2/...)
    endpoints: ['http://localhost:4000'], // Server URLs for OpenAPI spec
  },
  // highlight-end
})
```

This definition is common to all runtimes that allow a module to be served as a REST API.

Several libraries exist in the Node.js ecosystem to serve these APIs. One of the most popular is [Fastify](https://fastify.dev/) which combines simplicity with top-level performance. To serve APIs with Fastify, the specific Mondrian runtime `@mondrian-framework/rest-fastify` must be installed and imported. It offers a really simple `serve` function that you can call passing the Fastify server and the API definition.

```ts showLineNumbers
// highlight-end
import myModule from './my-module'
import { rest } from '@mondrian-framework/rest'
// highlight-start
import { serve } from '@mondrian-framework/rest-fastify'
import { fastify } from 'fastify'

const api = rest.build({
  module: myModule,
  version: 1, // API version
  functions: {
    // ... function mappings
  },
  // ... other api configurations
})

// highlight-start
const server = fastify()
serve({
  server,
  api,
  context: async ({ request }) => {
    // Build context needed by the module from the request
    return { authorization: request.headers.authorization }
  },
  options: {
    // Enable OpenAPI specification endpoint
    introspection: { path: '/openapi', ui: 'swagger' },
  },
})

server.listen({ port: 4000 }).then((address) => {
  console.log(`Server started at address ${address}`)
  console.log(`OpenAPI specification available at ${address}/openapi`)
})
// highlight-end
```

## Functions

By constructing an API using `rest.build`, you specify which functions from the module are exposed and how they map to REST endpoints using the `functions` field. This field takes an object where keys are function names from the module, and values define their REST mapping(s).

For each function, you can specify a single mapping object or an array of mapping objects. Each mapping object configures how the function is exposed as a REST API endpoint and affects its representation in the generated OpenAPI specification.

### Method

Specify the HTTP `method` (e.g., `'get'`, `'post'`, `'put'`, `'delete'`, `'patch'`) for the endpoint. If omitted, Mondrian attempts to infer it based on the function's operation type (e.g., 'query' maps to 'get', 'mutation' maps to 'post').

```ts showLineNumbers
// ... inside rest.build
functions: {
  getUser: { method: 'get' },
  updateUser: { method: 'put' },
  createUser: { method: 'post' }, // Explicitly POST
}
// ...
```

### Path

Define the URL `path` for the endpoint relative to the base API path (`/api/v{version}` by default). If omitted, it defaults to `/{functionName}`.

```ts showLineNumbers
// ... inside rest.build
functions: {
  registerUser: { method: 'post', path: '/users/register' },
  getProfile: { method: 'get', path: '/profile' }, // Path overrides default
}
// ...
```

You can include path parameters using curly braces (e.g., `{userId}`). These parameter names **must** correspond to fields in the function's input type, and those fields **must** be scalar types (string, number, boolean, etc.).

```ts showLineNumbers
// ... inside rest.build
functions: {
  // Input type must have a 'userId' string/number field
  getUserDetails: { method: 'get', path: '/users/{userId}' },
  // Input type must have 'postId' and 'commentId' fields
  getComment: { method: 'get', path: '/posts/{postId}/comments/{commentId}' },
}
// ...
```

### Input Mapping and `inputName`

How a function's input type is mapped depends on the HTTP method and the presence of path parameters:

- **`GET`, `DELETE` Methods:**

  - If the input is an object/entity type, its fields (excluding path parameters) are mapped to **query parameters**. Scalar fields become standard query parameters, while complex fields (objects, arrays) use `deepObject` style (e.g., `?filter[name]=John&filter[age]=30`).
  - If the input is a scalar or array type and there are **no** path parameters, the entire input is mapped to a single query parameter. By default, this query parameter is named `input`, but you can customize it using the `inputName` option.

- **`POST`, `PUT`, `PATCH` Methods:**
  - If there are path parameters, only those corresponding fields from the input object are mapped to the path. The **remaining** fields of the input object are expected in the **request body** (typically as JSON).
  - If there are **no** path parameters, the entire function input is expected in the **request body**.

```ts showLineNumbers
// ... inside rest.build
functions: {
  // Input (e.g., { limit: number, type: string }) maps to ?limit=10&type=admin
  listUsers: { method: 'get', path: '/users' },

  // Input (e.g., string[]) maps to ?ids=one&ids=two or ?ids[0]=one&ids[1]=two
  // Use 'inputName' to change the query parameter name from 'input'
  getItemsByIds: { method: 'get', path: '/items', inputName: 'ids' },

  // 'userId' from input goes to path, rest of input goes to JSON body
  updateUser: { method: 'put', path: '/users/{userId}' },

  // Entire input goes to JSON body
  createUser: { method: 'post', path: '/users' },
}
// ...
```

### OpenAPI Generation

The runtime automatically generates an OpenAPI 3.1 specification based on your module definition and the REST API configuration.

- **Paths & Operations**: Generated from the `functions` mapping, including methods, paths, path parameters, and query parameters.
- **Schemas**: Mondrian types (input, output, errors) are converted into OpenAPI schemas, including references (`#/components/schemas/`) for named types (entities, named objects, custom types with names). Primitive types, validation rules (min/max length, patterns, etc.), and structures (objects, arrays, unions) are translated accordingly.
- **Request Bodies**: Generated for methods like `POST`, `PUT`, `PATCH` based on the input mapping.
- **Responses**: Includes a '200' success response with the output schema and error responses based on the function's declared errors and the configured `errorCodes`.
- **Security Schemes**: Defined in `rest.build` under `securities` and referenced in operations via the `security` mapping option.
- **Metadata**: Includes API `version`, `title` (module name), `description` (module description), and server `endpoints`.

You can typically access this specification via an introspection endpoint configured when serving the API (see [Serving](#definition) and `options.introspection`).

### Error codes

You can customize the HTTP status code returned for specific function errors. This is done using the `errorCodes` option within a function's mapping object. This mapping overrides any global error code mappings defined in `rest.build`. If an error is not mapped here or globally, it defaults to `400`.

```ts showLineNumbers
// ... inside rest.build
errorCodes: { // Global defaults
  badInput: 400,
  unauthorized: 401,
},
functions: {
  login: {
    method: 'post',
    path: '/login',
    // highlight-start
    errorCodes: { invalidCredentials: 401, accountLocked: 403 } // Specific codes for this function
    // highlight-end
  },
  getResource: {
    method: 'get',
    path: '/resources/{id}',
    // Errors not specified here will use global defaults or 400
  }
}
// ...
```

### Versioning

API versioning is supported at two levels:

1.  **API Version**: Set via the `version` field in `rest.build`. This defines the base version for the entire API deployment (e.g., `version: 2`). The runtime usually prefixes routes with `/api/v{version}` (configurable via `pathPrefix`).
2.  **Function Version Constraints**: Within a function mapping (or an array of mappings), use the `version` option with `min` and/or `max` properties to specify the API versions for which that specific mapping is active.

This allows maintaining backward compatibility or introducing changes in specific versions. See the [Versioning Guide](../../guides/07-versioning.md) for more details.

```ts showLineNumbers
// ... inside rest.build
version: 3, // Base API version is v3
functions: {
  legacyOp: { method: 'get', path: '/legacy', version: { max: 2 } }, // Only available up to v2
  currentOp: { method: 'get', path: '/current', version: { min: 3 } }, // Available from v3 onwards
  stableOp: { method: 'get', path: '/stable' }, // Available in v3 (the deployed version)
}
// ...
```

### Security

You define security requirements using two options:

1.  **`securities` (in `rest.build`)**: Defines named security schemes compatible with OpenAPI security schemes (e.g., HTTP Bearer, API Key, OAuth2).
2.  **`security` (in function mapping)**: Applies one or more defined security schemes to a specific endpoint. It takes an array of security requirement objects.

```ts showLineNumbers
// ... inside rest.build
securities: {
  // highlight-start
  bearerAuth: { type: 'http', scheme: 'bearer', description: 'Requires a JWT token' },
  apiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-KEY' },
  // highlight-end
},
functions: {
  getPublicData: { method: 'get', path: '/public' }, // No security
  getProtectedData: {
    method: 'get', path: '/protected',
    // highlight-next-line
    security: [{ bearerAuth: [] }] // Requires 'bearerAuth' scheme
  },
  adminOp: {
    method: 'post', path: '/admin',
    // highlight-next-line
    security: [{ bearerAuth: [] }, { apiKeyAuth: [] }] // Requires EITHER bearer OR apiKey
  }
}
// ...
```

Refer to the OpenAPI specification for details on security requirement objects. Mondrian uses this information for both documentation generation and potentially for integrating with authentication/authorization middleware (depending on the server adapter).

## Global Options

The `options` field in `rest.build` allows configuring global settings for the API.

### Endpoints

The `endpoints` option is an array of strings specifying the base URLs where your API is hosted. This information is used to populate the `servers` field in the generated OpenAPI specification, helping API consumers understand where to send requests.

```ts showLineNumbers
// ... inside rest.build
options: {
  // highlight-next-line
  endpoints: ['https://api.example.com', 'https://staging.api.example.com'],
  // ... other options
}
// ...
```

### Path Prefix

The `pathPrefix` option defines a common prefix added to all routes defined in the `functions` mapping. The default prefix is `/api`. The final route pattern will be `{pathPrefix}/v{version}{functionPath}`.

```ts showLineNumbers
// ... inside rest.build
version: 1,
options: {
  // highlight-next-line
  pathPrefix: '/service/data', // Routes will be like /service/data/v1/...
  // ... other options
}
// ...
```

Set `pathPrefix: ''` to have routes directly under `/v{version}/...`.

### Server Options (`@mondrian-framework/rest-fastify`)

When using `serve` from `@mondrian-framework/rest-fastify`, the `options` object allows configuring server-specific features:

- **`introspection`**: Controls the OpenAPI specification endpoint.
  - `path`: The path where the OpenAPI JSON spec is served (e.g., `/openapi`).
  - `ui`: ('swagger' | 'scalar' | 'redoc' | 'rapidoc'): Optionally serve an interactive documentation UI at the same path. If not specified, only the JSON spec is served.
  - Set to `undefined` or `false` to disable the introspection endpoint.

```ts showLineNumbers
// ... when calling serve from @mondrian-framework/rest-fastify
serve({
  server,
  api,
  context: async () => ({}),
  options: {
    // highlight-start
    introspection: {
      path: '/docs', // Serve spec and UI at /docs
      ui: 'swagger', // Use Swagger UI
    },
    // highlight-end
  },
})
```

