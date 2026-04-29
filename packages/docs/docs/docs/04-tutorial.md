---
sidebar_position: 3
title: Tutorial — Build a real API in 10 minutes
---

# Tutorial: build a real API in 10 minutes

[Getting started](./03-getting-started.md) showed an `echo` endpoint exposed as REST and GraphQL. This tutorial is the next step: we'll build a tiny user-registration service the way you would actually deploy one — with **typed errors**, **providers** for context (auth, db), **security policies** for the data graph, and **Prisma-style retrieve**.

By the end you'll have one module that runs as REST and GraphQL simultaneously, with field-level security applied automatically.

## What we'll build

A `user` module with three functions:

- `register(email, password) → User` — public, returns typed errors
- `login(email, password) → { jwt }` — public, rate-limited
- `me() → User` — authenticated, returns the caller's profile

We'll add security policies that ensure the JWT-validated caller can read their own full profile but only public fields on other users.

## Step 1 — Define the data model

```ts showLineNumbers
// model.ts
import { model } from '@mondrian-framework/model'

export const User = () =>
  model.entity({
    id: model.string(),
    email: model.email(),
    displayName: model.string({ minLength: 1, maxLength: 60 }),
    createdAt: model.timestamp(),
    // password is intentionally NOT here — it never leaves the database.
  })

export type User = model.Infer<ReturnType<typeof User>>
```

Two things to note:

- **`model.entity` (not `object`)** — entities have identity. `retrieve` and `security` only target entities.
- **The lazy `() => model.entity(...)` form** — required so the type can reference itself or other entities (e.g. when we add `posts: model.array(Post)` later).

## Step 2 — Type your errors

```ts showLineNumbers
// errors.ts
import { model } from '@mondrian-framework/model'
import { error } from '@mondrian-framework/module'

export const errors = error.define({
  weakPassword: { message: 'Password too weak', details: model.object({ reason: model.string() }) },
  emailAlreadyUsed: { message: 'Email already registered' },
  invalidCredentials: { message: 'Invalid email or password' },
  unauthorized: { message: 'Authentication required' },
})
```

Errors are **values, not exceptions**. They show up in the OpenAPI spec, in the GraphQL union type, and in your TS types — so callers can't ignore them.

## Step 3 — Build a provider for the database

Providers are dependency injection. They run **once per function execution** and inject typed context into the body.

```ts showLineNumbers
// providers.ts
import { provider } from '@mondrian-framework/module'
import { result } from '@mondrian-framework/model'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient() // singleton — instantiate OUTSIDE the body

export const dbProvider = provider.build({
  body: async () => result.ok({ prisma }),
})
```

## Step 4 — Build a provider for auth

```ts showLineNumbers
import { errors } from './errors'

export const authProvider = provider.build({
  errors: { unauthorized: errors.unauthorized },
  body: async ({ authorization }: { authorization?: string }) => {
    if (!authorization) return result.fail({ unauthorized: {} })
    const userId = await verifyJwt(authorization) // your JWT verification
    if (!userId) return result.fail({ unauthorized: {} })
    return result.ok({ userId })
  },
})
```

The first parameter `{ authorization }` is the **provider's contextual input**. All providers' inputs are merged into the module's context-input type, so the runtime knows what to pass.

## Step 5 — Implement the functions

```ts showLineNumbers
// register.ts
import { functions } from '@mondrian-framework/module'
import { result, model } from '@mondrian-framework/model'
import { dbProvider } from './providers'
import { errors } from './errors'
import { User } from './model'

export const register = functions
  .define({
    input: model.object({
      email: model.email(),
      password: model.string({ minLength: 8 }),
      displayName: model.string({ minLength: 1, maxLength: 60 }),
    }),
    output: User,
    errors: { weakPassword: errors.weakPassword, emailAlreadyUsed: errors.emailAlreadyUsed },
    options: { operation: { command: 'create' } },
  })
  .use({ providers: { db: dbProvider } })
  .implement({
    async body({ input, db: { prisma } }) {
      if (input.password.length < 8) {
        return result.fail({ weakPassword: { details: { reason: 'too short' } } })
      }
      const exists = await prisma.user.findUnique({ where: { email: input.email } })
      if (exists) return result.fail({ emailAlreadyUsed: {} })

      const created = await prisma.user.create({
        data: { email: input.email, password: await hash(input.password), displayName: input.displayName },
      })
      return result.ok(created)
    },
  })
```

The `me` function uses both the database and the auth provider:

```ts showLineNumbers
// me.ts
export const me = functions
  .define({
    output: User,
    errors: { unauthorized: errors.unauthorized },
    retrieve: { select: true },
  })
  .use({ providers: { db: dbProvider, auth: authProvider } })
  .implement({
    async body({ retrieve, db: { prisma }, auth: { userId } }) {
      const user = await prisma.user.findUnique({ ...retrieve, where: { id: userId } })
      if (!user) return result.fail({ unauthorized: {} })
      return result.ok(user)
    },
  })
```

## Step 6 — Compose the module with security

```ts showLineNumbers
// module.ts
import { module, security } from '@mondrian-framework/module'
import { result } from '@mondrian-framework/model'
import { register, login, me } from './functions'
import { User } from './model'

export const userModule = module.build({
  name: 'user',
  functions: { register, login, me },
  context: async ({ authorization }: { authorization?: string }) => result.ok({ authorization }),
  policies({ auth }) {
    if (auth?.userId) {
      // Authenticated caller: full read of own User, public fields on others.
      return security
        .on(User)
        .allows({ selection: true, restriction: { id: { equals: auth.userId } } })
        .allows({ selection: { id: true, displayName: true } })
    }
    // Anonymous caller: only id + displayName.
    return security.on(User).allows({ selection: { id: true, displayName: true } })
  },
  options: { maxSelectionDepth: 5 }, // prevent deep-selection DoS
})
```

The policies block is the powerful part: it runs on *every* `retrieve`-enabled function, *for every entity in the result graph*. You don't have to remember to call it — you can't forget.

## Step 7 — Serve as REST + GraphQL simultaneously

```ts showLineNumbers
// app.ts
import { fastify } from 'fastify'
import { rest, serve as serveRest } from '@mondrian-framework/rest-fastify'
import { graphql, serveWithFastify as serveGraphQL } from '@mondrian-framework/graphql-yoga'
import { userModule } from './module'

const server = fastify()

serveRest({
  server,
  api: rest.build({
    module: userModule,
    version: 1,
    functions: {
      register: { method: 'post', path: '/users' },
      login: { method: 'post', path: '/login' },
      me: { method: 'get', path: '/me' },
    },
    errorCodes: { unauthorized: 401, weakPassword: 400, emailAlreadyUsed: 409, invalidCredentials: 401 },
  }),
  context: async ({ request }) => ({ authorization: request.headers.authorization }),
  options: { introspection: { path: '/openapi', ui: 'scalar' } },
})

serveGraphQL({
  server,
  api: graphql.build({
    module: userModule,
    functions: {
      register: { type: 'mutation' },
      login: { type: 'mutation' },
      me: { type: 'query' },
    },
  }),
  context: async ({ fastify: { request } }) => ({ authorization: request.headers.authorization }),
  options: { introspection: true },
})

server.listen({ port: 4000 })
```

## Step 8 — Try it

```bash
# REST
curl -X POST http://localhost:4000/v1/users \
  -H 'content-type: application/json' \
  -d '{"email":"a@b.com","password":"correct horse","displayName":"Ada"}'

# GraphQL
curl http://localhost:4000/graphql \
  -H 'content-type: application/json' \
  -d '{"query":"mutation{register(input:{email:\"a@b.com\",password:\"correct horse\",displayName:\"Ada\"}){id email}}"}'
```

Both protocols return the same shape, validate the same schema, and apply the same security policies. The OpenAPI spec lives at `/openapi`, the GraphQL playground at `/graphql`.

## What's next

- **[Security](./guides/01-security.md)** — deeper patterns for policies (followers-only, field-level masks).
- **[Mocking](./guides/04-mocking.md)** — `def.mock(...)` for contract tests and frontend prototyping.
- **[Versioning](./guides/07-versioning.md)** — REST API versioning across breaking changes.
- **[Testing](./guides/03-testing.md)** — strategies for testing functions, providers, and modules.
- **Custom runtimes** — see `fundamentals/runtime/05-custom-runtime.md` for WebSockets, alt brokers, or anything Mondrian doesn't ship out of the box.

If anything in this tutorial is unclear, please [open an issue](https://github.com/mondrian-framework/mondrian-framework/issues/new/choose) — clarity here is a contribution.
