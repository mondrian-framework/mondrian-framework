# Mondrian

![CI](https://github.com/twinlogix/mondrian-framework/actions/workflows/ci-checks.yml/badge.svg)
[![codecov](https://codecov.io/gh/twinlogix/mondrian-framework/graph/badge.svg?token=DT2P5BRCMX)](https://codecov.io/gh/twinlogix/mondrian-framework)

[Home page](https://mondrian-framework.github.io/mondrian-framework/)

## Usage example

In this section, we’ll walk through an example of how to use the Mondrian framework in TypeScript. We’ll create a simple registration function, add typed errors, and serve it through a REST API.

- [Build functions](#build-functions)
- [Build module](#build-module)
- [Serve module as REST endpoint](#serve-module-rest)
- [Serve module as GRAPHQL endpoint](#serve-module-graphql)

For this example we'll need to install this packages: 
```
npm i @mondrian-framework/model \
      @mondrian-framework/module \
      @mondrian-framework/rest \
      @mondrian-framework/graphql \
      @mondrian-framework/graphql-fastify \
      @mondrian-framework/rest-fastify \
      fastify
```

### Build functions

In this first example, we’re creating a simple registration function using the Mondrian framework. The function takes an email and password as input and returns a JSON web token as output:

```typescript
import { types } from '@mondrian-framework/model'
import { functions } from '@mondrian-framework/module'

const register = functions.build({
  input: types.object({ email: types.email(), password: types.string() }),
  output: types.object({ jwt: types.string() }),
  errors: undefined,
  retrieve: undefined,
  async body({ input: { email, password } }) {
    // weak password check
    if (password.length < 3) {
      throw new Error('Weak password.')
    }
    // register logic ...
    return { jwt: '...' }
  },
})
```

This is your first Mondrian function! Notice the `errors` and `retrieve` parameters? Let’s dive deeper into these with another example:

```typescript
import { types, result } from '@mondrian-framework/model'
import { functions } from '@mondrian-framework/module'

const register = functions.build({
  input: types.object({ email: types.email(), password: types.string() }),
  output: types.object({ jwt: types.string() }),
  errors: {
    weakPassword: types.string(),
    emailAlreadyUsed: types.string(),
  },
  retrieve: undefined,
  async body({ input: { email, password } }) {
    // weak password check
    if (password.length < 3) {
      return result.fail({ weakPassword: 'Need at least 3 characters' })
    }
    if (false /* email check logic */) {
      return result.fail({ emailAlreadyUsed: 'This email is already used' })
    }
    // register logic ...
    return result.ok({ jwt: '...' })
  },
})
```

Now, we’ve added typed errors to the same function. Isn’t that neat? But what about `retrieve` parameter? That’s a more advanced topic which we’ll cover later. For now, let’s focus on exposing our function through a REST API.

### Build module

This is how to build the Mondrian module:

```typescript
import { module } from '@mondrian-framework/module'

const myFunctions = { register } //here we put all the module functions

//instantiate the Mondrian module
const moduleInstance = module.build({
  name: 'my-module',
  version: '0.0.0',
  functions: myFunctions,
  context: async () => ({}),
})
```

### Serve module REST

This is how we can serve the module as a REST API endpoint:

```typescript
import { rest } from '@mondrian-framework/rest'
import { serve } from '@mondrian-framework/rest-fastify'
import { fastify } from 'fastify'

//Define the mapping of Functions<->Methods
const api = rest.build({
  module: moduleInstance,
  version: 2,
  functions: {
    register: [
      {
        method: 'put',
        path: '/user',
        errorCodes: { weakPassword: 400, emailAlreadyUsed: 401 },
        version: { max: 1 },
      },
      {
        method: 'post',
        path: '/login',
        errorCodes: { weakPassword: 400, emailAlreadyUsed: 403 },
        version: { min: 2 },
      },
    ],
  },
  options: { introspection: true },
}

//Start the server
const server = fastify()
serve({ server, api, context: async ({}) => ({}) })
server.listen({ port: 4000 }).then((address) => {
  console.log(`Server started at address ${address}/openapi`)
})
```

With REST introspection enabled, you can visit http://localhost:4000/openapi to view the Swagger documentation with the OpenAPI v3 specification of our served functions. Enjoy exploring your newly created API!

### Serve module GRAPHQL

We also could serve the module as a GraphQL endpoint:

```typescript
import { graphql } from '@mondrian-framework/graphql'
import { serve } from '@mondrian-framework/graphql-fastify'
import { fastify } from 'fastify'

//Define the mapping of Functions<->Methods
const api = graphql.build({
  module: moduleInstance,
  version: 2,
  functions: {
    register: { type: 'mutation' },
  },
  options: { introspection: true },
}

//Start the server
const server = fastify()
serve({ server, api, context: async ({}) => ({}) })
fastifyInstance.listen({ port: 4000 }).then((address) => {
  console.log(`Server started at address ${address}/graphql`)
})
```

With Graphql introspection enabled, you can visit http://localhost:4000/graphql to open the Yoga schema navigator. Enjoy exploring your newly created API! Nothing stops you from exposing the module with both graphql and rest endpoint.
