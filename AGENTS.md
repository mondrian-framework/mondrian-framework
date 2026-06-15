# AGENTS.md — Mondrian Framework

A reference for AI developer agents working on the Mondrian Framework monorepo.

## What this project is

**Mondrian Framework** is a TypeScript framework for **modular server-side applications** focused on type safety, functional programming, and modern API standards. You define data models and functions once; Mondrian generates compliant OpenAPI, GraphQL (and Protobuf, planned) APIs and servers — no codegen step (purely TS types).

Core ideas (from `packages/docs/docs/docs/01-introduction.md`):
- **Model**: formal representation of a domain concept/value object (DDD-style entities and value objects).
- **Function**: named operation with typed inputs, outputs, errors, and side effects.
- **Module**: named, reusable group of functions sharing a domain.
- **Runtime**: environment that executes modules (REST, GraphQL, SQS, cron, custom...).

Programming style mixes FP/FRP with PP. Inspired by Clean Architecture (Martin), DDD (Evans), Modern Software Engineering (Farley). 100% TypeScript on Node ≥ 24 (Deno/Bun WIP).

## Repository layout

```
mondrian-framework/        (npm workspaces monorepo, package name: @mondrian-framework/root)
├─ package.json            workspaces, scripts (build/test/coverage/release)
├─ tsconfig.json           strict, NodeNext modules, project references, path aliases
├─ vite.config.ts          vitest config; testTimeout 10s; coverage excludes docs
├─ .changeset/             changesets-managed releases
├─ .github/                CI (ci-checks.yml badge in README)
├─ assets/
└─ packages/
   ├─ utils/               low-level TS utilities (UnionToIntersection, AtLeastOnePropertyOf, etc.)
   ├─ model/               core type system; submodules: model, decoding, encoding, validation, result, path, arbitrary, utils
   ├─ module/              functions, modules, providers, guards, errors, security, retrieve, client, middleware, logger, exception, serialization
   ├─ provider/
   │  └─ rate-limiter/     rate limiter provider+guard (sliding window, optional Redis store)
   ├─ rest/                framework-agnostic REST builder + OpenAPI 3.1 generator + REST client
   ├─ rest-fastify/        Fastify adapter — exports `serve` and re-exports `rest`
   ├─ graphql/             GraphQL schema/resolver generator (mondrian → GraphQL)
   ├─ graphql-yoga/        GraphQL Yoga adapter — exports `serveWithFastify`, `createServer`, re-exports `graphql`
   ├─ aws-sqs/             SQS consumer runtime — exports `sqs`, `listen`
   ├─ aws-lambda-sqs/      SQS handler for AWS Lambda — exports `handler`
   ├─ aws-lambda-rest/     REST handler for AWS Lambda (`lambda-api`) — exports `handler`, `Request`, `Response`
   ├─ cron/                scheduled cron-like runtime — exports `cron`, `start`
   └─ docs/                Docusaurus site; canonical docs live in packages/docs/docs/docs

Note: `arbitrary` is not a separate workspace package — it lives at `packages/model/src/arbitrary/arbitrary.ts` and is re-exported as `arbitrary` from `@mondrian-framework/model`.
```

A reference application showing the full REST + GraphQL + Prisma + security setup lives in the [template project](https://github.com/mondrian-framework/template) (separate repo).

## Workspaces, paths, and aliases

`package.json#workspaces` lists every internal package; `tsconfig.json#paths` aliases each as `@mondrian-framework/<pkg>`. TS uses `composite` + `references` for incremental builds. Internal packages reference each other with `*` versions in their `package.json#dependencies`.

## Public API surface (what to import)

```ts
// model package
import { model, result, decoding, encoding, validation, path, arbitrary, utils } from '@mondrian-framework/model'

// module package
import {
  module, functions, provider, guard, error, retrieve, security,
  client, logger, exception, middleware, serialization, utils,
} from '@mondrian-framework/module'

// runtimes
import { rest, client, utils } from '@mondrian-framework/rest'   // rest, client (REST client), utils
import { serve, rest } from '@mondrian-framework/rest-fastify'
import { graphql } from '@mondrian-framework/graphql'
import { graphql, serveWithFastify, createServer } from '@mondrian-framework/graphql-yoga'
import { sqs, listen } from '@mondrian-framework/aws-sqs'
import { handler, Request, Response } from '@mondrian-framework/aws-lambda-rest'
import { handler } from '@mondrian-framework/aws-lambda-sqs'
import { cron, start } from '@mondrian-framework/cron'
import { rateLimiter, Slot, Store, RedisStore, Rate, parseRate } from '@mondrian-framework/rate-limiter'
```

`packages/model/src/index.ts` re-exports as `model`, `encoding`, `decoding`, `validation`, `result`, `path`, `arbitrary`, `utils`.
`packages/module/src/index.ts` re-exports as `module`, `functions`, `logger`, `client`, `utils`, `serialization`, `exception`, `error`, `retrieve`, `security`, `provider`, `guard`, `middleware`.

## The model layer (`@mondrian-framework/model`)

Builders return `model.Type`. All accept `BaseOptions` (`name`, `description`, etc.).

- **Primitives**: `model.boolean()`, `model.string({ minLength, maxLength, regex })`, `model.number({ minimum, exclusiveMaximum })`, `model.integer({ minimum, maximum })`.
- **Date/time**: `datetime` (JS Date), `timestamp` (ms unix), `date`, `time` (RFC 3339), `timezone` (IANA).
- **Locations**: `countryCode`, `latitude`, `longitude`, `locale`, `currency`.
- **Other built-ins**: `email`, `phoneNumber` (E.164), `mac`, `ip`, `port`, `version` (semver), `json`, `url`, `uuid`, `isbn`, `rgb`, `rgba`, `unknown`, `record(type)`, `jwt({...claims}, 'RS256')`.
- **Enums / literals**: `model.enumeration(['a','b'])`, `model.literal('Hello')`.
- **Wrappers**: `optional`, `nullable`, `array` (immutable by default; `.mutable()` / `.immutable()`); chaining order matters (`.array().nullable()` ≠ `.nullable().array()`).
- **Objects vs entities**: `model.object({...})` for value objects (immutable readonly fields by default); `model.entity({...}, { description, retrieve: { where, orderBy, take, skip } })` for domain concepts with identity. Entities are what `retrieve`, security policies, and ORM mapping target.
- **Unions**: `model.union({ tagA: TypeA, tagB: TypeB })` — tagged at the model level.
- **Lazy types**: `const User = () => model.entity({...})`. Required for self/circular references; the function name is the type name (or use `.setName('X')`).
- **Custom types**: `model.custom<Name, Options, Inferred>(name, encoder, decoder, validator, arbitrary, options?)`. Decoder validates basic shape; validator enforces semantic rules. Both return `decoding.Result` / `validation.Result`. Arbitrary uses `fast-check`. See `packages/docs/docs/docs/fundamentals/model/01-definition.md` for the canonical port-type example.
- **Inference**: `type T = model.Infer<typeof T>`. Encoded form via `model.InferEncoded`.
- **Operations on a Type**: `.encode(value)`, `.decode(unknown)`, `.example()`, `.setName(...)`, `.setOptions(...)`, `.optional()`, `.nullable()`, `.array()`, `.sensitive()` (e.g. for passwords), `.mutable()`, `.immutable()`.
- **`result` module**: `result.ok(value)`, `result.fail({ errorKey: details })`. Functions never `throw` for application errors — they return `Result`s.

## The module layer (`@mondrian-framework/module`)

### Functions

```ts
const def = functions.define({ input, output, errors, retrieve, options })
const impl = def
  .use({ providers: { p: providerX }, guards: { g: guardX } })
  .implement({ async body({ input, retrieve, logger, tracer, ...injected }) { return result.ok(...) } })
```

- `input`/`output`: any `model.Type` (or omit for void). Single input parameter (compose with objects/unions for many).
- `errors`: map of error name → schema. Use `error.define({ key: { message, ...detailFields } })` for default-message convenience. `error.standard.UnauthorizedAccess`, `error.standard.BadInput` are built-ins.
- `retrieve`: enable Prisma-style projections — `{ select?, where?, orderBy?, take?, skip? }`. Uses Prisma syntax. `retrieve.allCapabilities` enables them all. Constraints can be narrowed per-entity in the entity definition (`retrieve: { where: { id: true }, take: { max: 10 }, ... }`).
- `options`: `namespace` (subgrouping for runtimes), `description`, `operation` (`'query' | 'command' | { command: 'create' | 'update' | 'delete' }`), `opentelemetry: boolean`.
- The `body` receives `{ input, retrieve, logger, tracer }` plus a key per declared provider/guard. Always `return result.ok(...)` / `return result.fail(...)` — missing `return` is a known footgun.
- `def.mock({ errorProbability, maxDepth })` produces a fully type-correct mock implementation for prototyping/contract use.

### Providers — DI for context-derived resources

```ts
const dbProvider = provider.build({ body: async () => result.ok({ prisma: prismaSingleton }) })

const authProvider = provider
  .use({ providers: { ... } })   // depends on other providers
  .build({
    errors: error.define({ unauthorized: { message: 'Unauthorized' } }),
    body: async ({ token }: { token?: string }, { /* parents */ }) => result.ok({ userId })
  })
```

- Providers' contextual inputs (first body param) accumulate into the **module context input** type. The runtime's `context: async (input) => ...` must produce all of them.
- A provider runs **once per function execution**. For singletons, instantiate outside `body`.
- A provider's declared `errors` must also appear in the `errors` of every function that `.use`s it.

### Guards — pre-execution gatekeepers

```ts
const authGuard = guard.build({
  errors: { unauthorized },
  body: async ({ authorization }: { authorization?: string }) =>
    isValid(authorization) ? result.ok() : result.fail({ unauthorized: {} }),
})
```

Same wiring as providers but `result.ok()` returns `undefined` (no value injected). Used as `.use({ guards: { auth: authGuard } })`. Errors must also be declared on the function.

### Modules

```ts
const modDef = module.define({ name, description?, functions, errors? })
const mod = modDef.implement({
  functions: { ... },
  context: async (runtimeInput) => result.ok({ /* satisfy union of all provider context-inputs */ }),
  policies(ctx) { return ... },          // optional security policies (see below)
  options: {
    checkOutputType: 'throw' | 'log' | 'ignore',  // default 'throw'
    maxSelectionDepth: 5,                          // default unlimited; recommend 3–10 in prod
    opentelemetry: true,                           // default true
    resolveNestedPromises: false,
    preferredDecodingOptions: { errorReportingStrategy: 'allErrors' },
  },
})
```

Module-level `errors` can be raised from the `context` builder and are auto-added to every function's contract. Context builder runs **per invocation** — be mindful of expensive setup.

### Security policies

Defined per request via `policies(context)`:

```ts
security
  .on(User)
  .allows({ selection: true, restriction: { id: { equals: userId } } })
  .allows({ selection: { id: true, email: true } })
  .on(Post)
  .allows({ selection: true, filter: { visibility: { equals: 'PUBLIC' } } })
```

- `selection`: `true` (all fields) or per-field `{ id: true, ... }`.
- `restriction`/`filter`: Prisma-like `where` predicates. Rules evaluated in order — first matching restriction's selection applies.
- Applied automatically to functions with `retrieve`. Filters out unauthorized rows/fields _before_ returning. Traversed entities all need `.on(...)` rules to allow graph navigation.
- A canonical end-to-end example lives in the [template project](https://github.com/mondrian-framework/template).

### Logger & Tracer (OpenTelemetry)

Always available in `body` args:
- `logger.logDebug | logInfo | logWarn | logError | logFatal(message, attributes?)`. Auto-context: `moduleName`, `operationName`.
- `tracer.startActiveSpan(name, fn)`, `tracer.startActiveSpanWithOptions(name, opts, fn)`. Span has `setStatus`, `recordException`, `setAttribute(s)`, `end`.

### Clients

- **Module client** (`client.build({ module, context })` from `@mondrian-framework/module`): in-process, fully typed (return types projected from `select`), bypasses HTTP. `.withMetadata({...})` for request-scoped metadata.
- **REST client** (`client.build({ endpoint, rest })` from `@mondrian-framework/rest`): real HTTP `fetch` to a deployed REST API, derived from the `rest.build` spec. `.withHeaders({...})` for auth.
- Clients can be built from just the **interface** (function/module definitions) + REST spec — no implementation needed. Enables decoupled FE/BE distribution.

## Runtimes

### REST + OpenAPI 3.1 — `@mondrian-framework/rest` + `@mondrian-framework/rest-fastify`

```ts
const api = rest.build({
  module,
  version: 2,
  functions: {
    register: [
      { method: 'post', path: '/subscribe', version: { min: 2 } },
      { method: 'put', path: '/user', version: { max: 1 } },
    ],
    login: { method: 'post', path: '/login', errorCodes: { invalidLogin: 401 } },
    getUser: { method: 'get', path: '/users/{userId}' },        // path params from input fields
    listItems: { method: 'get', inputName: 'ids' },             // single scalar/array → query param
  },
  securities: { bearerAuth: { type: 'http', scheme: 'bearer' } },
  errorCodes: { unauthorized: 401, notFound: 404 },             // global defaults; func-level overrides
  options: { pathPrefix: '/api', endpoints: ['http://localhost:4000'] },
})
serve({ server, api, context: async ({ request }) => ({ authorization: request.headers.authorization }),
        onError({ error, logger }) { ... },
        options: { introspection: { path: '/openapi', ui: 'swagger' | 'scalar' | 'redoc' | 'rapidoc' } } })
```

- HTTP method inference from `operation` if omitted; default path `/{functionName}`.
- Path params must match scalar input fields. `GET`/`DELETE` → query params (deepObject for nested); `POST`/`PUT`/`PATCH` → body (minus path-param fields).
- API versioning: `version` global + `version: { min, max }` per mapping. Routes prefixed `/{pathPrefix}/v{n}`.
- OpenAPI components/schemas auto-generated, including security requirements.

### GraphQL — `@mondrian-framework/graphql` + `@mondrian-framework/graphql-yoga`

```ts
const api = graphql.build({
  module,
  functions: {
    getUser: { type: 'query' },
    register: { type: 'mutation', name: 'signup' },     // optional rename
  },
})
serveWithFastify({ server, api, context: async ({ fastify: { request } }) => ({ ... }),
                   onError({ error, logger }) { ... },
                   options: { introspection: true, endpoint: '/graphql' } })
```

- `retrieve` capabilities map to `where`/`orderBy`/`skip`/`take` args + GraphQL selection sets.
- Functions with a `namespace` are grouped under that namespace in the schema.
- No versioning concept (use deprecation/schema evolution).

### Other runtimes

- `@mondrian-framework/aws-sqs` — SQS consumer.
- `@mondrian-framework/aws-lambda-sqs` — SQS handler for Lambda.
- `@mondrian-framework/aws-lambda-rest` — REST on Lambda via `lambda-api`.
- `@mondrian-framework/cron` — scheduled cron execution.
- **Custom runtime** (`packages/docs/docs/docs/fundamentals/runtime/05-custom-runtime.md`): trigger → decode input → build context → `module.<fn>.apply` (or `rawApply` for raw bytes) → encode result. Pattern for WebSockets, alt brokers, IoT, CLIs, etc.

### Rate limiter — `@mondrian-framework/rate-limiter`

Sliding-window with optional `RedisStore`. Two flavors:
- **Provider**: `rateLimiter.buildProvider({ rate: '10 requests in 1 minute', store? })` → `.check(key)`, `.apply(key)` inside the function.
- **Guard**: `rateLimiter.buildGuard({ errors, key, onLimit, rate, store? })` → automatic gate.

## Conventions & gotchas

- **Always `return` `result.ok`/`result.fail`** — missing return won't always type-error.
- **Lazy types `() => model.entity({...})`** for any reference loop; the function name becomes the type name.
- **Provider/guard errors must also be declared** on every function that `.use`s them.
- **Module context builder runs per invocation** — instantiate heavy clients outside.
- **Set `maxSelectionDepth`** in production to prevent DoS via deep selections.
- **Use `model.entity` (not `object`) for domain concepts** — entities are what `retrieve`, security, and ORM bridges target.
- **Strict TS**: monorepo uses `"strict": true`, `composite: true`, NodeNext modules. Don't break references.
- **`@mondrian-framework/utils`** holds shared TS helpers; check there before writing utility types.
- **Coverage excludes** `packages/docs/**`.
- **`module.build` vs `module.define().implement()`**: `build` produces an implemented module from interface+impl in one step; `define` returns just the interface and exposes `.implement(...)` (also goes through `build`). Functions analogously have `.define()` + `.implement()` (no top-level `functions.build`). Splitting interface from implementation lets the interface package be shipped independently of the impl — see the [template project](https://github.com/mondrian-framework/template) for the canonical pattern.

## Common scripts (root)

```bash
npm run build       # tsc across workspaces
npm test            # vitest across workspaces
npm run coverage    # v8 coverage
npm run pretty      # prettier --write **/*.ts
npm run clear       # remove build artifacts
npm run release     # changeset add && changeset version
npm run publish     # changeset publish
```

Per-package: `npm run test --workspace=@mondrian-framework/<pkg>`. Tests use **vitest** + **fast-check** (`@fast-check/vitest`); test timeout 10s. Tests live under `packages/<pkg>/tests/*.test.ts`.

## Documentation source of truth

`packages/docs/docs/docs/` is the canonical doc source (Docusaurus site at https://mondrianframework.com/):
- `01-introduction.md`, `02-features.md`, `03-getting-started.md`, `04-tutorial.md`
- `fundamentals/model/{01-definition,02-typing,03-encode,04-decode,05-validation}.md`
- `fundamentals/function/{01-definition,02-implementation,03-provider,04-guard}.md`
- `fundamentals/module/{01-definition,02-implementation}.md`
- `fundamentals/runtime/{index,05-custom-runtime}.md`, `runtime/API/{01-REST-OpenAPI,02-GraphQL-API}.md`, `runtime/queue-consumer/02-AWS SQS.md`
- `guides/{01-security,02-prisma,03-testing,04-mocking,05-logging,06-tracing,07-versioning,09-clients}.md`

A template starter project lives at https://github.com/mondrian-framework/template.

## Minimal end-to-end recipe

```ts
import { model, result } from '@mondrian-framework/model'
import { functions, module, error, provider } from '@mondrian-framework/module'
import { rest } from '@mondrian-framework/rest'
import { serve } from '@mondrian-framework/rest-fastify'
import { fastify } from 'fastify'

const errors = error.define({ weakPassword: { message: 'Weak password' } })

const register = functions
  .define({
    input: model.object({ email: model.email(), password: model.string() }),
    output: model.object({ jwt: model.string() }),
    errors,
    options: { namespace: 'user', operation: { command: 'create' } },
  })
  .implement({ async body({ input, logger }) {
    if (input.password.length < 8) return result.fail({ weakPassword: {} })
    logger.logInfo('registered', { email: input.email })
    return result.ok({ jwt: '...' })
  } })

const m = module.build({ name: 'demo', functions: { register } })

const api = rest.build({
  module: m, version: 1,
  functions: { register: { method: 'post', path: '/register' } },
  errorCodes: { weakPassword: 400 },
})

const server = fastify()
serve({ server, api, context: async () => ({}), options: { introspection: { path: '/openapi', ui: 'swagger' } } })
server.listen({ port: 4000 })
```
