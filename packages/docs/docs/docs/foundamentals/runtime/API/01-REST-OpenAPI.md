# REST (OpenAPI 3.1)

This runtime allows a Mondrian module to be served as a REST API conforming to the **OpenAPI 3.1** specification. Each function can be mapped as a REST service, whose inputs and outputs are configured as query parameters, path variables or raw body content.

The runtime, in addition to exposing a Web server for the API, provides a complete OpenAPI 3.1 specification automatically produced from the definition of the module model and functions.

## Package
To use this runtime you need to start adding the `@mondrian-framework/rest` dependency and import the `rest` namespace from it:
```ts showLineNumbers
import { rest } from '@mondrian-framework/rest';
```

## Definition
This runtime first requires the definition of a component typically called `api` and to do this it provides a `build` function that accepts the module and some runtime specific parameters.

```ts showLineNumbers
import { rest } from '@mondrian-framework/rest';
import myModule from './my-module';

const api = rest.build({
  module: myModule,
  version: 2,
  functions: {
    register: { method: 'post', path: '/subscribe' }
    login: { method: 'post', path: '/login' },
    readPosts: { method: 'get', path: '/user/{userId}/posts' },
  }
})
```

This definition is common to all runtimes that allow a module to be served as a REST API. 

Several libraries exist in the Node.js ecosystem to serve these APIs. One of the most popular is [Fastify](https://fastify.dev/) which combines simplicity with top-level performance. To serve APIs with Fastify, the specific Mondrian runtime `@mondrian-framework/rest-fastify` must be installed and imported. It offers a really simple `serve` function that you can call passing the Fastify server and the APIs.

```ts showLineNumbers
import { rest } from '@mondrian-framework/rest';
// highlight-start
import { serve } from '@mondrian-framework/rest-fastify'
import { fastify } from 'fastify'
// highlight-end
import myModule from './my-module';

const api = rest.build({
  module: myModule,
  version: 2,
  functions: {
    register: { method: 'post', path: '/subscribe' }
    login: { method: 'post', path: '/login' },
    readPosts: { method: 'get', path: '/user/{userId}/posts' },
  }
})

// highlight-start
const server = fastify()
serve({ server, api })
server.listen({ port: 4000 }).then((address) => {
  console.log(`Server started at address ${address}`)
})
// highlight-end
```

## Functions
By constructing an API, it is possible to specify which functions are to be published and in what manner by using a value key object to be passed to the `functions` field.

For each function, it is possible to specify a number of configurations that have an impact on how it is exposed as a REST API and consequently its OpenAPI specification.

### Method
You can specify the HTTP `method` on each API.

```ts showLineNumbers
// ...
functions: {
  register: { method: 'post' }
  getPosts: { method: 'get' },
}
// ...
```

### Path
An API is server by default at a path corresponding to the key of the map, but you can customize it using a `path` option.

```ts showLineNumbers
// ...
functions: {
  register: { method: 'post', path: '/subscribe' }
  getPosts: { method: 'get', path: '/posts' },
}
// ...
```

You can also define some path variables using a pattern matching mechanism. Every path variable name must match a field of the input of the function.

```ts showLineNumbers
// ...
functions: {
  register: { method: 'post', path: '/subscribe' }
  getPosts: { method: 'get', path: '/users/{userId}/posts' },
}
// ...
```

### Input Name

### OpenAPI

## Error codes

## Version

## Security

## Options

### Endpoints

### Path Prefix


