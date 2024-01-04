---
sidebar_position: 2
---

# Getting started

This tutorial will show how to set up a basic back-end application with Mondrian Framework 
that serve a simple API both as a REST service and a GraphQL query.

## Installing Mondrian Framework

Create a new directory `myproject`, and from there follow this steps to initialize a standard 
Node.JS project with TypeScript:

- Run: `cd myproject`, this goes into the created project folder.
- Run: `npm init` and follow the prompts to setup a new Node.js project. This will generate a package.json file for you.
- Run: `npm install typescript --save-dev` to add TypeScript as a dev dependency
- Run: `npx tsc --init` to initialize you TypeScript project with a default tsconfig.json

You are now ready to install Mondrian Framework on your project. The framework is highly modular 
and you can choose the right modules for your project base on your needs. In this example we want 
to create a simple backend server that exposes a REST API.

```
npm i @mondrian-framework/model 
      @mondrian-framework/module 
      @mondrian-framework/rest-fastify 
      @mondrian-framework/graphql-yoga
      fastify
```

## Hello World API

Mondrian Framework promotes the decoupling of the parts of an application by well-defined abstractions, 
which is why creating an API requires defining a function, a module that contains it and a runtime that 
executes the latter.

```ts showLineNumbers
import { model } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'
import { serve as serveREST, rest } from '@mondrian-framework/rest-fastify'
import { serveWithFastify as serveGraphQL, graphql } from '@mondrian-framework/graphql-yoga'
import { fastify } from 'fastify'

const server = fastify()

// function
const helloWorldFunction = functions
  .define({
    input: model.,
    output: model.string(),
  })
  .implement({
    async body() {    
      return 'Hello World!'
    },
  })

// module
const helloWorldModule = module.build({
  name: 'hello-world',
  functions: { helloWorld: helloWorldFunction },
  context: async () => ({}),
})

// REST runtime
const restAPI = rest.build({
  module: helloWorldModule,
  options: { introspection: true },
})
serveGraphQL({ server, api: restAPI, context: async ({}) => ({}) })

// GraphQL runtime
const graphQLAPI = graphql.build({
  module: moduleInstance,
  options: { introspection: true },
})
serveGraphQL({ server, api: graphQLAPI, context: async ({}) => ({}) })

server.listen({ port: 4000 }).then((address) => {
  console.log(`Server started.`)
  console.log(`OpenAPI specification available at address ${address}/openapi`)
  console.log(`GraphQL endpoint available at address ${address}/graphql`)
})
```