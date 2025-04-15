# REST (OpenAPI 3.1)

This runtime allows a Mondrian module to be served as a REST API conforming to the **OpenAPI 3.1** specification. Each function within the module can be mapped to a REST endpoint, with its inputs and outputs configured as query parameters, path parameters, or request/response bodies.

The runtime, in addition to exposing a web server for the API, automatically generates a complete OpenAPI 3.1 specification derived from the definitions of the module, its functions, and their underlying models.

## Package

To use this runtime, start by adding the `@mondrian-framework/rest` dependency and importing the `rest` namespace from it:

```ts showLineNumbers
import { rest } from '@mondrian-framework/rest'
```

## Definition

This runtime first requires the definition of an API component, typically created using the `rest.build` function. This function accepts the implemented Mondrian module and several runtime-specific configuration parameters.

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

This API definition structure (`rest.build(...)`) is intended to be portable and can potentially be used by different server adapters (like the Fastify one shown next).

Several libraries exist in the Node.js ecosystem to serve REST APIs. One popular choice is [Fastify](https://fastify.dev/), which combines simplicity with excellent performance. To serve Mondrian REST APIs using Fastify, you install the specific adapter package `@mondrian-framework/rest-fastify` and import its `serve` function. This function takes the Fastify server instance, the API definition created by `rest.build`, a context builder function, and optional server options.

```ts showLineNumbers
// Assuming myModule is an implemented Mondrian Module from ./my-module
// Assuming api is the result of rest.build({...}) as shown above

// highlight-start
import { serve } from '@mondrian-framework/rest-fastify'
import { fastify } from 'fastify'
// highlight-end

// ... (rest.build definition as above)

// highlight-start
const server = fastify()

serve({
  server, // The Fastify server instance
  api,    // The API definition from rest.build
  context: async ({ request }) => {
    // Build the context required by the module.
    // This function receives the Fastify request object.
    // It must return the input expected by myModule's context builder.
    return { authorization: request.headers.authorization }
  },
  options: {
    // Server-specific options (for rest-fastify)
    // Enable OpenAPI specification endpoint and Swagger UI
    introspection: { path: '/openapi', ui: 'swagger' },
  },
})

server.listen({ port: 4000 }).then((address) => {
  console.log(`Server started at ${address}`)
  console.log(`OpenAPI specification available at ${address}/openapi`)
})
// highlight-end
```

## Functions Mapping (`rest.build`)

When constructing an API using `rest.build`, you specify which functions from the module are exposed and how they map to REST endpoints via the `functions` field. This field is an object where keys are the names of functions within the module, and the values define their corresponding REST mapping(s).

For each function, you can provide either a single mapping object or an array of mapping objects (if a function needs to be exposed via multiple endpoints/methods). Each mapping object configures how the function is exposed as a REST API endpoint and influences its representation in the generated OpenAPI specification.

### Method

Specify the HTTP `method` (e.g., `'get'`, `'post'`, `'put'`, `'delete'`, `'patch'`) for the endpoint. If omitted, Mondrian attempts to infer it based on the function's semantic `operation` type defined in its options (e.g., a function marked as `'query'` typically maps to `GET`, while `'mutation'` often maps to `POST`).

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

Define the URL `path` for the endpoint, relative to the base API path (which is `/api/v{version}` by default, but configurable via `pathPrefix`). If `path` is omitted, it defaults to `/{functionName}`.

```ts showLineNumbers
// ... inside rest.build
functions: {
  registerUser: { method: 'post', path: '/users/register' },
  getProfile: { method: 'get', path: '/profile' }, // Path overrides default
}
// ...
```

You can include path parameters using curly braces (e.g., `{userId}`). These parameter names **must** correspond directly to field names in the function's input type, and those input fields **must** be scalar types (like string, number, boolean).

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

How a function's input type is mapped to the HTTP request depends on the HTTP method and the presence of path parameters:

- **`GET`, `DELETE` Methods:**

  - If the input type is an object/entity, its fields (excluding any fields used as path parameters) are mapped to **query parameters**. Scalar fields become standard query parameters (e.g., `?limit=10`). Complex fields like nested objects or arrays typically use serialization styles like `deepObject` (e.g., `?filter[name]=John&filter[age]=30`) or potentially JSON encoding, depending on the server adapter and configuration.
  - If the input type is a scalar (e.g., `string`) or an array (e.g., `string[]`) and there are **no** path parameters, the entire input is mapped to a single query parameter. By default, this parameter is named `input`. You can customize this name using the `inputName` option in the mapping.

- **`POST`, `PUT`, `PATCH` Methods:**
  - If path parameters are defined in the `path`, the corresponding fields from the function's input object are taken from the URL path. All **remaining** fields of the input object are expected in the **request body** (usually as JSON).
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

The runtime automatically generates an OpenAPI 3.1 specification based on your module definition, function definitions, model definitions, and the REST API configuration provided to `rest.build`.

- **Paths & Operations**: Generated from the `functions` mappings, including methods, paths, path parameters, and query parameters.
- **Schemas**: Mondrian types (used in function inputs, outputs, and errors) are converted into reusable OpenAPI schemas, often placed under `#/components/schemas/`. This includes proper representation of primitives, objects, arrays, unions, enums, literals, and custom types, along with validation constraints (min/max length, patterns, required fields, etc.).
- **Request Bodies**: Generated for methods like `POST`, `PUT`, `PATCH`, referencing the appropriate input schemas and reflecting the input mapping rules.
- **Responses**: Includes a default '200 OK' success response referencing the output schema. Error responses are generated based on the function's declared `errors` and the configured `errorCodes` (both function-specific and global).
- **Security Schemes**: Defined globally in `rest.build` under the `securities` field and referenced within specific operations based on the `security` option in the function mappings.
- **Metadata**: Includes the API `version`, `title` (module name), `description` (module description), and server `endpoints` defined in the `rest.build` configuration.

You can typically access this generated OpenAPI specification via an introspection endpoint configured when serving the API (see the [Serving](#serving-the-api-with-fastify) example and the `options.introspection` setting).

### Error Codes (`errorCodes`)

You can customize the HTTP status code returned for specific, named errors declared by a function. This is configured using the `errorCodes` option within that function's mapping object. This function-specific mapping overrides any global error code mappings defined at the top level of `rest.build`. If a function error is not mapped specifically here or globally, it typically defaults to a `400 Bad Request` status code.

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

1.  **API Version**: Set globally via the `version` field in `rest.build`. This defines the primary version for the entire API deployment (e.g., `version: 2`). The runtime usually prefixes generated routes with `/api/v{version}` (this base path prefix is configurable via the `pathPrefix` option).
2.  **Function Version Constraints**: Within a function's mapping object (or for each object in an array of mappings), use the `version` option with `min` and/or `max` properties. This specifies the API versions for which that particular mapping (endpoint) is active.

This allows maintaining backward compatibility or introducing breaking changes gradually across different versions. See the [Versioning Guide](../../../guides/07-versioning.md) for more details.

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

You define security requirements for your API using two related options:

1.  **`securities` (Top-level in `rest.build`)**: Defines named security schemes available for use in the API. These definitions must be compatible with OpenAPI security scheme objects (e.g., HTTP Bearer, API Key, OAuth2).
2.  **`security` (Within a function mapping)**: Applies one or more of the globally defined security schemes to a specific endpoint. It takes an array of security requirement objects, where each object specifies the required scheme(s) for a particular security option (e.g., `[{ bearerAuth: [] }]` requires `bearerAuth`).

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

Refer to the OpenAPI 3.1 specification for details on defining security schemes and security requirement objects. Mondrian uses this information primarily for generating accurate OpenAPI documentation. Integrating with actual authentication/authorization middleware depends on the specific server adapter and how you configure context building.

## Global Options (`rest.build`)

The `options` field at the top level of `rest.build` allows configuring global settings for the API definition.

### Endpoints (`options.endpoints`)

This option is an array of strings specifying the base URLs where your API will be hosted. This information populates the `servers` field in the generated OpenAPI specification, helping API consumers and documentation tools know where to send requests.

```ts showLineNumbers
// ... inside rest.build
options: {
  // highlight-next-line
  endpoints: ['https://api.example.com', 'https://staging.api.example.com'],
  // ... other options
}
// ...
```

### Path Prefix (`options.pathPrefix`)

This option defines a common prefix string added before the version segment in all generated routes. The default prefix is `/api`. The final route pattern constructed is typically `{pathPrefix}/v{version}{functionPath}`.

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

Setting `pathPrefix: ''` results in routes directly under the version segment, like `/v{version}/...`.

## Server Options (`@mondrian-framework/rest-fastify`)

When using the `serve` function from the `@mondrian-framework/rest-fastify` adapter, its `options` parameter allows configuring server-specific features:

- **`options.introspection`**: Controls the automatic generation and serving of the OpenAPI specification endpoint.
  - `path`: (string) The URL path where the OpenAPI JSON specification will be served (e.g., `'/openapi'`).
  - `ui`: (Optional: `'swagger'` | `'scalar'` | `'redoc'` | `'rapidoc'`): If provided, serves an interactive API documentation UI (like Swagger UI) at the same `path` alongside the JSON spec. If omitted, only the raw JSON specification is served.
  - Set `introspection` to `undefined` or `false` to completely disable this feature.

