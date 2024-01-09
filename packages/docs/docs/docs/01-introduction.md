---
sidebar_position: 1
---

# Introduction

Mondrian is a framework for building **modular server-side applications ready to evolve**. 
To accomplish this ambitious goal we believe software needs to be splitted in small, cohesive and decoupled parts, with well defined boundaries built on solid abstractions.

## Concepts

Mondrian is primarily a **conceptual framework** that encompasses a set of well-defined abstractions for designing a modern, feature-rich applications with characteristics such as modularity, cohesion, separation of concerns, information hiding and loose coupling. Its main focus is on the concept of decoupling as a tool for preventing unnecessary dependencies that are the primary barrier to change and thus to the evolution of a system. Following the four main abstractions on which the framework is built.

### Model
As defined in DDD (Domain Driven Design), a model is a **formal representation of a domain concept** (also known as an entity) or an immutable value object (that refers to a specific value with no identity). This representation consists of a set of attributes, each with its own formal properties and constraints, and possibly relationships with other models.

### Function 
A function is a named software constructs that define a series of operations that are designed to accomplish a specific task. A function is characterized by inputs, outputs and side effects. A function is said to be pure if it is free of side effects and if each input always corresponds to the exact same output.

### Module
A module is a named set of functions referring to a shared domain, with a well-defined perimeter. A module  designed to make it reusable. A module must be reusable and for that it must have no dependencies other than those needed by its functions to accomplish their tasks.

### Runtime
A runtime is a container or in general an environment that can independently execute one or more modules on a target infrastructure by providing them with all the resources they need. Every module should be compatible and interoperable with all runtimes, switching from one runtime to another should therefore not require any changes to a module. 

![Framework architecture overview](/img/architecture-overview.png)

## Programming style
Mondrian Framework combines elements of **FP (Functional Programming)** and FRP (Functional Reactive Programming) with mainstream PP (Procedural Programmin) to minimize errors resulting from improper state management and unwanted side effects. It represents an attempt to combine these different programming styles in order to maximize productivity while still producing quality software.

## Languages and JavaScript runtimes
Its current implementation is 100% written in [TypeScript](https://www.typescriptlang.org/) ancd can be executed on [Node.js](https://nodejs.org/) ([Deno](https://deno.land/) and [Bun](https://bun.sh/) compatibility is still in progress). While it is fully interoperable with any JavaScript package, it heavily relies on TypeScript typing to leverage its full potential and provide developers with user-friendly types.

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
