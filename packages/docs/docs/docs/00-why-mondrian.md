---
sidebar_position: 0
title: Why Mondrian?
---

# Why Mondrian?

> **One TypeScript model. REST + GraphQL + RPC out of the box. No code generation.**

If you've already used `tRPC`, `ts-rest`, `NestJS`, `Effect`, `Encore`, or `Hono + Zod`, this page explains where Mondrian fits.

## The problem Mondrian solves

You want to expose the same business logic in multiple shapes:

- **REST + OpenAPI** for partners, public APIs, and tools that speak HTTP
- **GraphQL** for your web/mobile frontend
- **An RPC channel** between internal microservices
- **A queue consumer** (SQS, Kafka, …) for async work
- **A cron job** or **CLI** for ops tasks

Most TypeScript frameworks make you pick *one* of these and re-implement the contract for the others. Mondrian lets you write the **model + functions** once and run any combination of those runtimes against it.

## Comparison with other TypeScript backend frameworks

| What you need                                  | Mondrian | tRPC      | ts-rest | NestJS      | Effect (HTTP) |
| ---------------------------------------------- | :------: | :-------: | :-----: | :---------: | :-----------: |
| Single source of truth for the data model      |    ✅    |    ✅     |   ✅    |     ⚠️      |      ✅       |
| Serve the same model as REST                   |    ✅    |    ❌     |   ✅    |     ✅      |      ✅       |
| Serve the same model as GraphQL                |    ✅    |    ❌     |   ❌    | ⚠️ codegen  |      ❌       |
| Serve the same model as native RPC             |    ✅    |    ✅     |   ❌    |     ❌      |      ⚠️       |
| OpenAPI 3.1 spec auto-generated                |    ✅    |    ❌     |   ⚠️    |     ⚠️      |      ❌       |
| Typed errors as part of the public contract    |    ✅    |    ⚠️     |   ⚠️    |     ❌      |      ✅       |
| Field/row-level security on retrieve           |    ✅    |    ❌     |   ❌    | ⚠️ DIY      |      ❌       |
| Built-in OpenTelemetry tracing                 |    ✅    |    ❌     |   ❌    |     ⚠️      |      ⚠️       |
| Same-process & HTTP clients from the same spec |    ✅    |    ✅     |   ✅    |     ❌      |      ⚠️       |
| Pluggable runtimes (SQS, cron, Lambda, CLI)    |    ✅    |    ❌     |   ❌    |     ⚠️      |      ⚠️       |

> ✅ first-class · ⚠️ partial / requires extra work · ❌ not a goal

## When to pick Mondrian

- You want **one model, many protocols** without rewriting validation, types, or specs three times.
- You care about **typed errors as part of the contract** — not stringly-typed exceptions that leak through HTTP.
- You need **field- and row-level security** that applies automatically to every traversal of the data graph.
- You ship serverless workloads (Lambda, SQS) **and** long-lived services and want both to use the same module.
- You want a **mockable contract** so the frontend can move ahead of the backend.

## When to skip Mondrian

- Your service is single-protocol, single-runtime, and you want the smallest possible surface area. **`tRPC`** or **`Hono + Zod`** will get out of your way faster.
- You're heavily invested in NestJS modules / decorators and the ergonomic switch isn't worth the rewrite.
- You need a feature Mondrian hasn't shipped yet (e.g., production-ready Protobuf, gRPC, or non-Node runtimes — those are on the roadmap but not done).

## Design tradeoffs

Mondrian explicitly chooses:

- **No code generation step.** All type derivation happens through the TypeScript type system. Refactors light up across your codebase immediately, but heavy generic types can stress the compiler on huge schemas.
- **Application errors are values, never exceptions.** Functions return `result.ok(...)` or `result.fail(...)`. This makes errors part of the contract — but it means you can't `try/catch` your way out of business logic.
- **Modules are pure descriptions; runtimes execute them.** This separation enables interface/impl split and pluggable runtimes, at the cost of some indirection compared to "decorate a class and go" frameworks.
- **Strict TypeScript only.** The framework leans hard on `strict: true`, project references, and NodeNext modules. Bring a strict-mode codebase or be prepared to upgrade.

## Where to next

- **[Getting started](./03-getting-started.md)** — install Mondrian and ship a working REST + GraphQL endpoint in 10 minutes.
- **[Introduction](./01-introduction.md)** — the four abstractions Mondrian is built on (Model, Function, Module, Runtime).
- **[Features](./02-features.md)** — the full feature list at a glance.
