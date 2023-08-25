---
sidebar_position: 1
---

# Introduction

Mondrian is a framework for building modular server-side applications ready to evolve. It is primarily a [conceptual framework](./conceptual-framework.md) that encompasses a set of well-defined abstractions for designing a modern, feature-rich backend application with characteristics such as modularity, cohesion, separation of concerns, information hiding and loose coupling. It also combines elements of FP (Functional Programming) and FRP (Functional Reactive Programming) with mainstream PP (Procedural Programmin) to minimize errors resulting from improper state management and unwanted side effects.

Its current implementation is written in [TypeScript](https://www.typescriptlang.org/) for [Node.js](https://nodejs.org/) ([Deno](https://deno.land/) and [Bun](https://bun.sh/) compatibility is still in progress). While it is fully interoperable with any JavaScript package, it heavily relies on Typescript dynamic typing to leverage its full potential and provide developers with user-friendly constructs.

## Mission

Mondrian Framework mission is to enable developers to build **better software ready to evolve**.

To accomplish this ambitious goal we believe software needs to be splitted in small, cohesive and decoupled parts, with well defined boundaries built on solid abstractions. Such parts are commonly named modules.

## Foundations

Mondrian Framework is designed on rock solid design principles heavily inspired by the following books:

- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) by Robert C. Martin
- [Domain-Driven Design](https://martinfowler.com/bliki/DomainDrivenDesign.html) by Eric Evans and Martin Fowler
- [Modern Software Engineering](https://www.davefarley.net/?p=352) by David Farley

It also naturally stems from a decade-long experience in software development and draws inspiration from various other frameworks and libraries already existing in the modern development landscape.

## Design principles

There are various well known best practices in software engineering, many of which are extensively discussed in reference texts. Although they are accepted and teached by most organizations, they often go unapplied in practice for various reasons, typically unjustifiable.

One of the goals of Mondrian Framework is to guide developers towards the systematic and almost automatic application of these practices to produce software with the following characteristics:

- **Modularity**: the degree to which a system’s components may be separated and recombined.

- **Cohesion**: the degree to which the elements inside a module belong together.

- **Separation of concerns**: design principle that manages complexity by partitioning the software system so that each partition is responsible for a separate concern, minimizing the overlap of concerns as much as possible.

- **Information hiding**: the process of removing details or attributes in the study of a system to focus attention on details of greater importance.

- **Loose coupling**: the degree to which components are weakly associated (have breakable relationships) with each other.

## Features

Following a list of the main features of Mondrian Framework:

- Model schema definition
- Validation using given or custom validators
- Custom scalars definition
- Model projection types and utilities
- Function definition
- Multiple API server generation
  - REST, with OpenAPI specification
  - GraphQL, both schema and resolvers
  - gRPC, including Protobuf definition
  - others from the community
- Multiple non-API runners
  - Running from messages (AWS SQS, ...)
  - Running from notifications (AWS SNS, ...)
  - Scheduled cron-like execution
  - others from the community
- Multiple runtimes
  - Container based
  - AWS Lambda
  - others from the community
  - Basic RBAC security framework
  - Advanced resource based security framework
- Automatic client SDK generation
- Dependency Injection
- Exception management
- Built-in mocking
- Built-in logging
- Built-in metrics
- Built-in tracing
- 100% TypeScript
