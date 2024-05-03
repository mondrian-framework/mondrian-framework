---
sidebar_position: 2
---

# Getting started

This tutorial will show how to set up a basic back-end application with Mondrian Framework
that serve a simple API both as a REST service and a GraphQL query.

## Installing Mondrian Framework

Create a new directory `myproject`, and from there follow these steps to initialize a standard
Node.JS project with TypeScript:

- Run: `cd myproject`, this goes into the created project folder.
- Run: `npm init` and follow the prompts to setup a new Node.js project. This will generate a package.json file for you.
- Run: `npm install typescript --save-dev` to add TypeScript as a dev dependency
- Run: `npx tsc --init` to initialize your TypeScript project with a default tsconfig.json

You are now ready to install Mondrian Framework on your project. The framework is highly modular
and you can choose the right modules for your project base on your needs. In this example we want
to create a simple backend server that exposes a REST API.

```
> npm i @mondrian-framework/model
      @mondrian-framework/module
      @mondrian-framework/rest-fastify
      @mondrian-framework/graphql-yoga
      fastify
```

## Writing your first API

Mondrian Framework promotes the decoupling of the parts of an application by well-defined abstractions,
which is why creating an API requires defining a function, a module that contains it and some runtimes
to execute the application.

Let's start by writing a very simple echo API.

### The model

First we define the input and output data model, which in this case will be simple strings.

```ts showLineNumbers
import { model } from '@mondrian-framework/model'

const Input = model.string()
const Output = model.string()
```

### The function

We continue by writing the definition and logic of the echo function.

```ts showLineNumbers
import { result } from '@mondrian-framework/model'
import { functions } from '@mondrian-framework/module'

// ...

const echoFunction = functions
  .define({
    input: Input,
    output: Output,
  })
  .implement({
    async body({ input }) {
      return result.ok(input)
    },
  })
```

### The module

At this point we define the module, in this case with only one function.

```ts showLineNumbers
import { module } from '@mondrian-framework/module'

// ...

const echoModule = module.build({
  name: 'echo',
  functions: { echo: echoFunction },
})
```

### The runtimes

In this example, to demonstrate the power of the framework, we will run the module on two
different runtimes, one as the Rest API and the other as the GraphQL operation.

```ts showLineNumbers
import { serveWithFastify as serveGraphQL, graphql } from '@mondrian-framework/graphql-yoga'
import { serve as serveREST, rest } from '@mondrian-framework/rest-fastify'
import { fastify } from 'fastify'

//...

const server = fastify()

const restAPI = rest.build({
  module: echoModule,
  options: { introspection: true },
})
serveGraphQL({ server, api: restAPI, context: async ({}) => ({}) })

const graphQLAPI = graphql.build({
  module: echoModule,
  options: { introspection: true },
})
serveGraphQL({ server, api: graphQLAPI, context: async ({}) => ({}) })

server.listen({ port: 4000 }).then((address) => {
  console.log(`Server started.`)
  console.log(`OpenAPI specification available at address ${address}/openapi`)
  console.log(`GraphQL endpoint available at address ${address}/graphql`)
})
```

### Runnable example

Below is the union of the previous pieces into easily executable code.

```ts showLineNumbers
import { serveWithFastify as serveGraphQL, graphql } from '@mondrian-framework/graphql-yoga'
import { model } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'
import { serve as serveREST, rest } from '@mondrian-framework/rest-fastify'
import { fastify } from 'fastify'

const Input = model.string()
const Output = model.string()

const echoFunction = functions
  .define({
    input: Input,
    output: Output,
  })
  .implement({
    async body({ input }) {
      return result.ok(input)
    },
  })

const echoModule = module.build({
  name: 'echo',
  functions: { echo: echoFunction },
})

const server = fastify()

const restAPI = rest.build({
  module: echoModule,
  options: { introspection: true },
})
serveGraphQL({ server, api: restAPI, context: async ({}) => ({}) })

const graphQLAPI = graphql.build({
  module: echoModule,
  options: { introspection: true },
})
serveGraphQL({ server, api: graphQLAPI, context: async ({}) => ({}) })

server.listen({ port: 4000 }).then((address) => {
  console.log(`Server started.`)
  console.log(`OpenAPI specification available at address ${address}/openapi`)
  console.log(`GraphQL endpoint available at address ${address}/graphql`)
})
```

## Building

The building of the application is nothing more than the normal build of a
TypeScript project, thus requiring simple compilation:

```
> tsc
```

## Running

Similarly, you can start it as a normal Node.js application. Assuming that the
sources have been compiled into the `/build/app.js` file:

```
> node build/app.js
```
