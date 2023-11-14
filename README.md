# Mondrian

![CI](https://github.com/twinlogix/mondrian-framework/actions/workflows/ci-checks.yml/badge.svg)
[![codecov](https://codecov.io/gh/mondrian-framework/mondrian-framework/graph/badge.svg?token=DT2P5BRCMX)](https://codecov.io/gh/mondrian-framework/mondrian-framework)

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
      @mondrian-framework/rest-fastify \
      @mondrian-framework/graphql \
      @mondrian-framework/graphql-yoga \
      fastify
```

### Build functions

In our first example, we'll guide you through creating a registration function using the Mondrian framework. This function, written in TypeScript, accepts an email and password as input and outputs a JSON web token:

```typescript
import { model } from '@mondrian-framework/model'
import { functions } from '@mondrian-framework/module'

const register = functions.build({
  input: model.object({ email: model.email(), password: model.string() }),
  output: model.object({ jwt: model.string() }),
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

Congratulations! You've just implemented your initial Mondrian function. To enhance error handling, let's explore a more advanced example where we introduce typed errors:

```typescript
import { model, result } from '@mondrian-framework/model'
import { functions } from '@mondrian-framework/module'

const register = functions.build({
  input: model.object({ email: model.email(), password: model.string() }),
  output: model.object({ jwt: model.string() }),
  errors: {
    weakPassword: model.string(),
    emailAlreadyUsed: model.string(),
  },
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

### Build module

Here's how you can build the Mondrian module using TypeScript:

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

This snippet showcases how to instantiate the Mondrian module, incorporating the functions you've defined.

### Serve module REST

Now, let's move on to serving the module as a REST API endpoint. The following TypeScript code demonstrates the mapping of functions to methods and how to start the server:

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
})

//Start the server
const server = fastify()
serve({ server, api, context: async ({}) => ({}) })
server.listen({ port: 4000 }).then((address) => {
  console.log(`Server started at address ${address}/openapi`)
})
```

By enabling REST introspection, you can explore your API using the Swagger documentation at http://localhost:4000/openapi.
<img width="777" alt="swagger-example" src="https://github.com/mondrian-framework/mondrian-framework/assets/50401517/12a5433d-5138-4e75-99de-4385b77b9062">


### Serve module GRAPHQL

You can serve the module also as a GraphQL endpoint with the following code:

```typescript
import { graphql } from '@mondrian-framework/graphql'
import { serve } from '@mondrian-framework/graphql-yoga'
import { fastify } from 'fastify'

//Define the mapping of Functions<->Methods
const api = graphql.build({
  module: moduleInstance,
  functions: {
    register: { type: 'mutation' },
  },
  options: { introspection: true },
})

//Start the server
const server = fastify()
serve({ server, api, context: async ({}) => ({}) })
server.listen({ port: 4000 }).then((address) => {
  console.log(`Server started at address ${address}/graphql`)
})
```

Enabling GraphQL introspection allows you to explore your API using the Yoga schema navigator at http://localhost:4000/graphql Nothing stops you from exposing the module with both a GraphQL and a REST endpoint.

<img width="777" alt="graphql-example" src="https://github.com/mondrian-framework/mondrian-framework/assets/50401517/c8283eca-9aaf-48b4-91a3-80b164397a19">
