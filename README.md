![CI](https://github.com/mondrian-framework/mondrian-framework/actions/workflows/ci-checks.yml/badge.svg)
[![codecov](https://codecov.io/gh/mondrian-framework/mondrian-framework/graph/badge.svg?token=DT2P5BRCMX)](https://codecov.io/gh/mondrian-framework/mondrian-framework)

# Mondrian

[Homepage](https://mondrianframework.com/)

[CI Tools](https://ci-tools.mondrianframework.com)

## 1 minute spinup example

Prerequisite:

- Node >= 20

```
git clone https://github.com/mondrian-framework/mondrian-framework.git
cd mondrian-framework
npm run spinup
```

Then query your endpoint with graphql or rest:

```bash
curl --location --globoff 'http://localhost:4000/graphql' \
--header 'Content-Type: application/json' \
--data-raw '{"query":"mutation register { user { register(input: { email: \"john@domain.com\", password: \"12345\", firstName: \"John\", lastName: \"Wick\" }) { ... on MyUser { id } ... on RegisterFailure { code } } } }" }'
```

## How it works

Mondrian allows you to define a data model in an intuitive human-readable way. In addition to model fields, types, possibly new scalars and relationships, you can utilize a wide range of validity rules or create new and reusable ones. Once the model is defined, the framework provides a set of fully automatic translation features to major standards: JSONSchema (OpenAPI), GraphQL and Protobuf.
<img width="777" alt="graphql-example" src="https://mondrianframework.com/schemas/main.svg"/>

## Usage example

In this section, we’ll walk through an example of how to use the Mondrian framework in TypeScript. We’ll create a simple registration function, add typed errors, and serve it through a REST API.

- [Mondrian](#mondrian)
  - [1 minute spinup example](#1-minute-spinup-example)
  - [How it works](#how-it-works)
  - [Usage example](#usage-example)
    - [Build functions](#build-functions)
    - [Build module](#build-module)
    - [Serve module REST](#serve-module-rest)
    - [Serve module GRAPHQL](#serve-module-graphql)
    - [Prisma integration](#prisma-integration)
    - [Apply graph security](#graph-security)

For this example we'll need to install this packages:

```
npm i @mondrian-framework/model \
      @mondrian-framework/module \
      @mondrian-framework/rest-fastify \
      @mondrian-framework/graphql-yoga \
      fastify
```

### Build functions

In our first example, we'll guide you through creating a registration function using the Mondrian framework. This function, written in TypeScript, accepts an email and password as input and outputs a JSON web token:

```typescript
import { model, result } from '@mondrian-framework/model'
import { functions } from '@mondrian-framework/module'

const register = functions
  .define({
    input: model.object({ email: model.email(), password: model.string() }),
    output: model.object({ jwt: model.string() }),
  })
  .implement({
    async body({ input: { email, password } }) {
      // weak password check
      if (password.length < 3) {
        throw new Error('Weak password.')
      }
      // register logic ...
      return result.ok({ jwt: '...' })
    },
  })
```

Congratulations! You've just implemented your initial Mondrian function. To enhance error handling, let's explore a more advanced example where we introduce typed errors:

```typescript
import { model, result } from '@mondrian-framework/model'
import { functions, error } from '@mondrian-framework/module'

const errors = error.define({
  weakPassword: { message: 'The password is weak', details: model.object({ reason: model.string() }) },
  emailAlreadyUsed: { message: 'This email is already used' },
})

const register = functions
  .define({
    input: model.object({ email: model.email(), password: model.string() }),
    output: model.object({ jwt: model.string({ minLength: 3 }) }),
    errors,
  })
  .implement({
    async body({ input: { email, password } }) {
      if (false /* weak password logic */) {
        return result.fail({ weakPassword: { details: { reason: 'Some reason' } } })
      }
      if (false /* email check logic */) {
        return result.fail({ emailAlreadyUsed: {} })
      }
      // register logic ...
      return result.ok({ jwt: '...' })
    },
  })
```

### Build module

Here's how you can build the Mondrian module using TypeScript:

```typescript
import { result } from '@mondrian-framework/model'
import { module } from '@mondrian-framework/module'

//instantiate the Mondrian module
const moduleInstance = module.build({
  name: 'my-module',
  functions: { register },
})
```

This snippet showcases how to instantiate the Mondrian module, incorporating the functions you've defined.

### Serve module REST

Now, let's move on to serving the module as a REST API endpoint. The following TypeScript code demonstrates the mapping of functions to methods and how to start the server:

```typescript
import { serve, rest } from '@mondrian-framework/rest-fastify'
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
})

//Start the server
const server = fastify()
serve({ server, api, context: async ({}) => ({}), options: { introspection: { path: '/openapi' } } })
server.listen({ port: 4000 }).then((address) => {
  console.log(`Server started at address ${address}/openapi`)
})
```

By enabling REST introspection, you can explore your API using the Swagger documentation at http://localhost:4000/openapi.
<img width="777" alt="swagger-example" src="https://github.com/mondrian-framework/mondrian-framework/assets/50401517/12a5433d-5138-4e75-99de-4385b77b9062">

### Serve module GRAPHQL

You can serve the module also as a GraphQL endpoint with the following code:

```typescript
import { serveWithFastify, graphql } from '@mondrian-framework/graphql-yoga'
import { fastify } from 'fastify'

//Define the mapping of Functions<->Methods
const api = graphql.build({
  module: moduleInstance,
  functions: {
    register: { type: 'mutation' },
  },
})

//Start the server
const server = fastify()
serveWithFastify({ server, api, context: async ({}) => ({}), options: { introspection: true } })
server.listen({ port: 4000 }).then((address) => {
  console.log(`Server started at address ${address}/graphql`)
})
```

Enabling GraphQL introspection allows you to explore your API using the Yoga schema navigator at http://localhost:4000/graphql Nothing stops you from exposing the module with both a GraphQL and a REST endpoint.

<img width="777" alt="graphql-example" src="https://github.com/mondrian-framework/mondrian-framework/assets/50401517/c8283eca-9aaf-48b4-91a3-80b164397a19">

### Prisma integration

This framework has a strong integration with prisma type-system and enable you to expose a graph of your data in a seamless-way.

Schema.prisma

```prisma
model User {
  id         String       @id @default(auto()) @map("_id") @db.ObjectId
  email      String       @unique
  password   String
  posts      Post[]
}

model Post {
  id          String         @id @default(auto()) @map("_id") @db.ObjectId
  content     String
  authorId    String         @db.ObjectId
  author      User           @relation(fields: [authorId], references: [id])
}
```

types.ts

```typescript
const User = () =>
  model.entity({
    id: model.string(),
    email: model.string(),
    //passowrd omitted, you can expose a subset of field
    posts: model.array(Post),
  })
const Post = () =>
  model.entity({
    id: model.string(),
    content: model.string(),
    author: User,
  })

const getUsers = functions
  .define({
    output: model.array(User),
    retrieve: { select: true, where: true, orderBy: true, skip: true, limit: true },
  })
  .implement({
    body: async ({ retrieve }) => result.ok(await prismaClient.user.findMany(retrieve)), //retrieve type match Prisma generated types
  })
```

By exposing the function as GraphQL endpoint we can navigate the relation between User and Post.

<img width="589" alt="image" src="https://github.com/mondrian-framework/mondrian-framework/assets/50401517/76308ec0-bca1-459f-8696-a9f296bf072f">

### Graph security

In this configuration, we have created a data breach. In fact, by retrieving users with the `getUsers` query, we are exposing the entire graph to every caller. To resolve this problem, we can (and in some cases should) implement a first level of security on the function that checks if the caller is an authenticated user. We can do this as follows:

```typescript
import { model, result } from '@mondrian-framework/model'
import { functions, provider, error } from '@mondrian-framework/module'

const { unauthorized } = error.define({ unauthorized: { message: 'Not authenticated!' } })

const authProvider = provider.build({
  errors: { unauthorized },
  body: async ({ authorization }: { authorization?: string }) => {
    if (!authorization) {
      return result.fail({ unauthorized: {} })
    }
    const userId = await verifyToken(authorization)
    if (!userId) {
      return result.fail({ unauthorized: {} })
    }
    return result.ok({ userId })
  },
})

const getUsers = functions
  .define({
    output: model.array(User),
    errors: { unauthorized },
    retrieve: { select: true, where: true, orderBy: true, skip: true, limit: true },
  })
  .use({ providers: { auth: authProvider } })
  .implement({
    body: async ({ retrieve, auth: { userId } }) => {
      const users = await prismaClient.user.findMany(retrieve)
      return result.ok(users)
    },
  })
```

A problem remains... What if a logged-in user selects all user passwords?! Or maybe traverses the graph and selects some private fields? Mondrian-Framework natively supports a layer of security that can be used to secure the graph. This mechanism is applied every time we call a function with some retrieve capabilities and for the protected types (defined by you). In the following example, we show how to define such a level of security:

```typescript
import { result } from '@mondrian-framework/model'
import { module, security } from '@mondrian-framework/module'

const moduleInstance = module.build({
  name: 'my-module',
  version: '0.0.0',
  functions: myFunctions,
  policies({ auth: { userId } }) {
    if (userId != null) {
      return (
        security
          //On entity "User" a logged user can read anything if it's selecting it's user
          //otherwise can read the "id" and the "email"
          .on(User)
          .allows({ selection: true, restriction: { id: { equals: userId } } })
          .allows({ selection: { id: true, email: true } })
          //On entity "Post" a logged user can read anything on every post
          .on(Post)
          .allows({ selection: true })
      )
    } else {
      // On unauthenticated caller we left visible only id of both "User" and "Post" entities
      return security
        .on(User)
        .allows({ selection: { id: true } })
        .on(Post)
        .allows({ selection: { id: true } })
    }
  },
})
```

This feature offers some more functionality that you can read about in the official documentation, or you can take a peek inside the example package where we define some more complex security policies (packages/example/src/core/security-policies.ts).
