![CI](https://github.com/mondrian-framework/mondrian-framework/actions/workflows/ci-checks.yml/badge.svg)
[![codecov](https://codecov.io/gh/mondrian-framework/mondrian-framework/graph/badge.svg?token=DT2P5BRCMX)](https://codecov.io/gh/mondrian-framework/mondrian-framework)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![npm: model](https://img.shields.io/npm/v/@mondrian-framework/model.svg?label=%40mondrian-framework%2Fmodel)](https://www.npmjs.com/package/@mondrian-framework/model)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

# Mondrian

> **One TypeScript model. REST + GraphQL + RPC out of the box. No code generation.**

[Homepage](https://mondrianframework.com/) ・ [Documentation](https://mondrianframework.com/docs/docs/introduction) ・ [Discussions](https://github.com/mondrian-framework/mondrian-framework/discussions) ・ [Issues](https://github.com/mondrian-framework/mondrian-framework/issues) ・ [Template project](https://github.com/mondrian-framework/template)

Mondrian is a TypeScript framework for **modular server-side applications**. You define your data model and your functions once; Mondrian serves them simultaneously over **OpenAPI 3.1**, **GraphQL**, and a native **RPC protocol** — and it ships with field-level security, OpenTelemetry, typed errors, and Prisma-style retrieval projections. Type-safety end-to-end without a code-generation step.

## Highlights

- **One contract, many protocols** — the same module can be exposed as REST, GraphQL, native RPC, an AWS SQS consumer, a cron job, a CLI, or AWS Lambda — without rewriting the contract.
- **No codegen** — pure TypeScript types, so refactors light up across your codebase immediately.
- **Typed errors as part of the contract** — functions return `result.ok(...)` / `result.fail(...)`. Errors are part of the API spec (OpenAPI / GraphQL union).
- **Field- and row-level security policies** — declarative `security.on(Entity).allows({ selection, restriction, filter })` rules applied automatically on every retrieve.
- **Prisma-style retrieval** — opt-in `select` / `where` / `orderBy` / `take` / `skip` projections that flow from HTTP/GraphQL all the way into your ORM.
- **Built-in OpenTelemetry** — tracing, structured logger, and per-function spans on by default.
- **Mockable contract** — `def.mock(...)` produces a fully-typed fake implementation. The interface package ships independently of the implementation, so frontends can consume the contract before the backend exists.
- **Strict TypeScript, functional style** — `result` types, immutable models by default, no exceptions for application errors.

## Why Mondrian?

| What you need                                  | Mondrian | tRPC      | ts-rest | NestJS      | Effect (HTTP) |
| ---------------------------------------------- | :------: | :-------: | :-----: | :---------: | :-----------: |
| Single source of truth for the data model      |    ✅    |    ✅     |   ✅    |    ⚠️      |     ✅       |
| Serve the same model as REST                   |    ✅    |    ❌     |   ✅    |    ✅      |     ✅       |
| Serve the same model as GraphQL                |    ✅    |    ❌     |   ❌    | ⚠️ codegen  |     ❌       |
| Serve the same model as native RPC             |    ✅    |    ✅     |   ❌    |    ❌      |     ⚠️       |
| OpenAPI 3.1 spec auto-generated                |    ✅    |    ❌     |   ⚠️    |    ⚠️      |     ❌       |
| Typed errors as part of the public contract    |    ✅    |    ⚠️     |   ⚠️    |    ❌      |     ✅       |
| Field/row-level security on retrieve           |    ✅    |    ❌     |   ❌    | ⚠️ DIY      |     ❌       |
| Built-in OpenTelemetry tracing                 |    ✅    |    ❌     |   ❌    |    ⚠️      |     ⚠️       |
| Same-process & HTTP clients from the same spec |    ✅    |    ✅     |   ✅    |    ❌      |     ⚠️       |
| Pluggable runtimes (SQS, cron, Lambda, CLI)    |    ✅    |    ❌     |   ❌    |    ⚠️      |     ⚠️       |

> ✅ first-class · ⚠️ partial / requires extra work · ❌ not a goal

**Pick Mondrian when** you need to expose the same business logic across multiple protocols (REST for partners, GraphQL for the SPA, RPC for internal services, SQS for async work) without re-implementing the contract or duplicating validation. **Skip Mondrian when** your service is single-protocol and the surface area of a richer framework would slow you down — `tRPC` or `Hono + Zod` will be lighter.

## Try it in under 1 minute

Prerequisite: Node ≥ 20.9

```bash
git clone https://github.com/mondrian-framework/mondrian-framework.git
cd mondrian-framework
npm run spinup
```

- GraphQL playground: <http://localhost:4000/graphql>
- OpenAPI / Swagger UI: <http://localhost:4000/openapi>
- Native RPC endpoint: <http://localhost:4000/mondrian>

```bash
curl --location --globoff 'http://localhost:4000/graphql' \
  --header 'Content-Type: application/json' \
  --data-raw '{"query":"mutation register { user { register(input: { email: \"john@domain.com\", password: \"12345\", firstName: \"John\", lastName: \"Wick\" }) { ... on MyUser { id } ... on RegisterFailure { code } } } }"}'
```

Want a starter? Clone the [template project](https://github.com/mondrian-framework/template).

## How it works

Mondrian lets you describe a data model in a readable, human-friendly way. Beyond fields, types, and relations, you can use a wide library of validation rules — or compose new reusable ones. Once the model exists, Mondrian generates spec-compliant **JSON Schema (OpenAPI)**, **GraphQL**, and (Protobuf, planned) endpoints automatically.

<img width="777" alt="mondrian model diagram" src="https://mondrianframework.com/schemas/main.svg"/>

## Usage example

We'll define a registration function with typed errors, expose it as REST and as GraphQL, then layer on Prisma + graph security.

- [Build the function](#build-functions)
- [Build the module](#build-module)
- [Serve as REST](#serve-module-rest)
- [Serve as GraphQL](#serve-module-graphql)
- [Mock the contract](#mock-the-contract)
- [Decouple frontend and backend](#decouple-frontend-and-backend)
- [Prisma integration](#prisma-integration)
- [Graph security](#graph-security)

Install:

```bash
npm i @mondrian-framework/model \
      @mondrian-framework/module \
      @mondrian-framework/rest-fastify \
      @mondrian-framework/graphql-yoga \
      fastify
```

### Build functions

A Mondrian function is a typed input / output / errors triple plus an implementation that returns a `Result`. **Application errors are values, never thrown exceptions** — they are part of the contract, so REST and GraphQL clients see them as typed responses.

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
      if (password.length < 8) {
        return result.fail({ weakPassword: { details: { reason: 'too short' } } })
      }
      if (await emailIsTaken(email)) {
        return result.fail({ emailAlreadyUsed: {} })
      }
      // register logic ...
      return result.ok({ jwt: '...' })
    },
  })
```

### Build module

```typescript
import { module } from '@mondrian-framework/module'

const moduleInstance = module.build({
  name: 'my-module',
  functions: { register },
})
```

### Serve module REST

```typescript
import { serve, rest } from '@mondrian-framework/rest-fastify'
import { fastify } from 'fastify'

const api = rest.build({
  module: moduleInstance,
  version: 2,
  functions: {
    register: [
      { method: 'put', path: '/user' },
      { method: 'post', path: '/login' },
    ],
  },
  errorCodes: { weakPassword: 400, emailAlreadyUsed: 401 },
})

const server = fastify()
serve({ server, api, context: async ({}) => ({}), options: { introspection: { path: '/openapi' } } })
server.listen({ port: 4000 }).then((address) => {
  console.log(`Server started at address ${address}/openapi`)
})
```

REST introspection at <http://localhost:4000/openapi> renders Swagger / Scalar / ReDoc / RapiDoc.
<img width="777" alt="swagger-example" src="https://github.com/mondrian-framework/mondrian-framework/assets/50401517/12a5433d-5138-4e75-99de-4385b77b9062">

### Serve module GRAPHQL

```typescript
import { serveWithFastify, graphql } from '@mondrian-framework/graphql-yoga'
import { fastify } from 'fastify'

const api = graphql.build({
  module: moduleInstance,
  functions: {
    register: { type: 'mutation' },
  },
})

const server = fastify()
serveWithFastify({ server, api, context: async ({}) => ({}), options: { introspection: true } })
server.listen({ port: 4000 }).then((address) => {
  console.log(`Server started at address ${address}/graphql`)
})
```

GraphQL introspection at <http://localhost:4000/graphql>. The same module can serve REST and GraphQL simultaneously.

<img width="777" alt="graphql-example" src="https://github.com/mondrian-framework/mondrian-framework/assets/50401517/c8283eca-9aaf-48b4-91a3-80b164397a19">

### Mock the contract

Every function exposes `.mock(...)` — a generated implementation that returns shape-correct fake data drawn from the model's `arbitrary` (powered by [fast-check](https://fast-check.dev/)). Useful for prototyping, contract tests, or unblocking the frontend before the backend exists.

```typescript
const fakeRegister = register.mock({ errorProbability: 0.1, maxDepth: 4 })

// fakeRegister has the same input/output/error contract as `register`,
// but returns generated fake data — no implementation required.
const m = module.build({ name: 'my-module', functions: { register: fakeRegister } })
```

### Decouple frontend and backend

Mondrian splits the **interface** (function/module *definitions*) from the **implementation**. Publish the interface package separately and let your frontend (or another service) build a fully-typed client without ever importing the server code.

```typescript
// in your shared @your-org/api-interface package
import { functions, module } from '@mondrian-framework/module'

export const registerInterface = functions.define({ input, output, errors })
export const moduleInterface = module.define({ name: 'my-module', functions: { register: registerInterface } })

// in the frontend
import { client } from '@mondrian-framework/rest'
const api = client.build({ endpoint: 'https://api.example.com', rest: restSpec })
const r = await api.register({ email, password })  // fully typed, including errors
```

The pattern is fully demonstrated in `packages/example/src/{interface,core}/`.

### Prisma integration

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

```typescript
const User = () =>
  model.entity({
    id: model.string(),
    email: model.string(),
    // password omitted on purpose — you choose which fields are exposed
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
    retrieve: { select: true, where: true, orderBy: true, skip: true, take: true },
  })
  .implement({
    body: async ({ retrieve }) => result.ok(await prismaClient.user.findMany(retrieve)),
  })
```

The `retrieve` argument's TypeScript type is structurally compatible with what Prisma expects — pass it straight through.

<img width="589" alt="image" src="https://github.com/mondrian-framework/mondrian-framework/assets/50401517/76308ec0-bca1-459f-8696-a9f296bf072f">

### Graph security

The example above leaks data: anyone calling `getUsers` can read all users *and* traverse the entire graph. Mondrian addresses this in two layers — a **provider** that gates the function, and **policies** that filter what each caller can read.

```typescript
import { provider, error } from '@mondrian-framework/module'

const { unauthorized } = error.define({ unauthorized: { message: 'Not authenticated!' } })

const authProvider = provider.build({
  errors: { unauthorized },
  body: async ({ authorization }: { authorization?: string }) => {
    if (!authorization) return result.fail({ unauthorized: {} })
    const userId = await verifyToken(authorization)
    if (!userId) return result.fail({ unauthorized: {} })
    return result.ok({ userId })
  },
})

const getUsers = functions
  .define({
    output: model.array(User),
    errors: { unauthorized },
    retrieve: { select: true, where: true, orderBy: true, skip: true, take: true },
  })
  .use({ providers: { auth: authProvider } })
  .implement({
    body: async ({ retrieve, auth: { userId } }) => result.ok(await prismaClient.user.findMany(retrieve)),
  })
```

Now layer field-level / row-level **policies** that apply automatically to any function with `retrieve`:

```typescript
import { module, security } from '@mondrian-framework/module'

const moduleInstance = module.build({
  name: 'my-module',
  functions: myFunctions,
  policies({ auth: { userId } }: { auth: { userId?: string } }) {
    if (userId != null) {
      return security
        // Logged user: full read on their own User record, public fields on others.
        .on(User)
        .allows({ selection: true, restriction: { id: { equals: userId } } })
        .allows({ selection: { id: true, email: true } })
        // Logged user: full read on every Post.
        .on(Post)
        .allows({ selection: true })
    }
    // Anonymous: only ids visible.
    return security
      .on(User)
      .allows({ selection: { id: true } })
      .on(Post)
      .allows({ selection: { id: true } })
  },
})
```

Filtering happens *before* values are returned to the caller, on every traversed entity. The example app (`packages/example/src/core/security-policies.ts`) demonstrates the richer patterns (followers-only Posts, etc).

## Runtimes

| Runtime                                  | Package                                  | Use case                                       |
| ---------------------------------------- | ---------------------------------------- | ---------------------------------------------- |
| REST + OpenAPI 3.1                       | `@mondrian-framework/rest-fastify`       | Public APIs, partner integrations              |
| GraphQL (Yoga)                           | `@mondrian-framework/graphql-yoga`       | Web/mobile frontends, federated graphs         |
| Native RPC                               | `@mondrian-framework/direct`             | Internal service-to-service                    |
| AWS SQS consumer                         | `@mondrian-framework/aws-sqs`            | Async background work                          |
| AWS Lambda — REST                        | `@mondrian-framework/aws-lambda-rest`    | Serverless HTTP                                |
| AWS Lambda — SQS                         | `@mondrian-framework/aws-lambda-sqs`     | Serverless async                               |
| Cron / scheduled                         | `@mondrian-framework/cron`               | Recurring jobs                                 |
| CLI                                      | `@mondrian-framework/cli-commander`      | Operational tools, scripts                     |
| Custom                                   | (build your own)                         | WebSockets, gRPC, IoT, alt brokers             |

The same module can run under any combination simultaneously.

## Stability and versioning

- Mondrian is currently in the `0.x` line — APIs may evolve. Breaking changes ship via [changesets](./.changeset/) and are documented in package CHANGELOGs.
- Each package is published independently; pin direct dependencies and let `peerDependencies` handle internal compatibility.
- Releases follow semantic versioning at the package level. Within a single Mondrian release wave, all internal packages are kept in sync.

## Community & support

- 💬 **[GitHub Discussions](https://github.com/mondrian-framework/mondrian-framework/discussions)** — questions, ideas, show-and-tell.
- 🐛 **[Issue tracker](https://github.com/mondrian-framework/mondrian-framework/issues)** — bugs and feature requests (please use the templates).
- 📖 **[Documentation site](https://mondrianframework.com/)** — full reference, including guides on testing, mocking, logging, tracing, versioning, and CI integration.
- 🤝 **[Contributing guide](./CONTRIBUTING.md)** — how to set up the monorepo, run tests, and submit a PR.
- 🛡️ **[Security policy](./SECURITY.md)** — how to report a vulnerability responsibly.

## License

Apache 2.0 — see [LICENSE](./LICENSE).
