---
sidebar_position: 2.1
---

# Model
The first and fundamental feature of Mondrian Framework is the ability to define the <strong>schema</strong> of a data model. This definition is a requirement to enable data translation into any current and future representations. Having a detailed data model in a formal language is a powerful tool in itself to ensure interoperability and longevity.

The approach through schema definition entails that the developer does not directly write the types representing their data model, but instead starts with defining the schema, which can contain additional information beyond what is supported by the target programming language, such as validation rules as an example. TypeScript types are then automatically inferred by the framework from the schema and provided to the user, ready to use.

Mondrian Framework takes inspiration from various libraries for declaring and validating data models, such as [Zod](https://zod.dev/), [io-ts](https://github.com/gcanti/io-ts), [Ajv](https://ajv.js.org/), [typia](https://typia.io/) and many others. It tries to combine their expressiveness, speed, and ease of use adding features not only to declare and validate a schema, but also to easily visit, process it and work with data projections.

Basically a model schema:
- Represents an entity of the application domain, in terms of data type, structure, attributes, relations and validation rules.
- Is defined using a collection of convenient framework functions to declare fields and their attributes.
- Provides generated TypeScript type definition.

## Example
The following schema describes a blogging platform:

```ts
import m from '@mondrian-framework/model'

const User = m.object({
  id: m.integer(),
  name: m.string().optional(),
  email: m.string({ format: 'email' }),
  address: Address.optional(),
  posts: m.reference(Post.array().optional()),
})
type User = m.Infer<typeof User>

const Address = m.object({
  street: m.string().optional(),
  city: m.string().optional(),
  zipcode: m.string().optional(),
  district: m.string().optional(),
  country: m.string(),
})
type Address = m.Infer<typeof Address>

const Post = m.object({
  id: m.integer(),
  createdAt: m.date(),
  updatedAt: m.date(),
  title: m.string({ maxLength: 200 }),
  content: t.string({ maxLength: 5000 }).optional(),
  author: m.reference(User),
})
type Post = m.Infer<typeof Post>
```

## TypeScript support
Mondrian Framework is entirely written in TypeScript. The use of typing greatly reduces the error rate and allows for increased productivity thanks to seamless integration with modern IDEs that provide powerful autocomplete features.

As shown in the previous example, by importing the `@mondrian-framework/model` module, we have access to a wide range of functions suggested by the IDE, enabling us to describe a model.

Furthermore, through the use of constructs such as conditional types and mapped types, it is possible to automatically generate the TypeScript type of a model based on its schema. As demonstrated in the example, it is sufficient to use the `Infer` utility type.

