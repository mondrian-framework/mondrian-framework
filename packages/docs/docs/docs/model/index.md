---
sidebar_position: 2.1
---

# Model

The first and fundamental feature of the Mondrian Framework is the ability to
define the **schema** of a data model. This definition is a requirement to
enable data translation into any current and future representations.
Having a detailed data model in a formal language is a powerful tool in
itself to ensure interoperability and longevity.

The approach through schema definition entails that the developer does not
directly write the types representing their data model, but instead starts with
defining the schema, which can contain additional information beyond what is
supported by the target programming language, such as validation rules as an
example.
TypeScript types are then automatically inferred by the framework from the
schema and provided to the user, ready to use.

Mondrian Framework takes inspiration from various libraries for declaring and
validating data models, such as [Zod](https://zod.dev/),
[io-ts](https://github.com/gcanti/io-ts), [Ajv](https://ajv.js.org/),
[typia](https://typia.io/), and many others.
It tries to combine their expressiveness, speed, and ease of use adding features
not only to declare and validate a schema but also to easily visit, process it,
and work with data projections.

Basically a model schema:

- Represents an entity of the application domain, in terms of data type,
  encoding, decoding, and validation rules.
- Is defined using a collection of convenient framework functions to declare
  fields and their attributes.
- Provides generated TypeScript type definition.

## Example

The following schema describes a blogging platform:

```ts showLineNumbers
import { model } from '@mondrian-framework/model'

const Address = model.object(
  {
    street: model.string().optional(),
    city: model.string().optional(),
    zipcode: model.string().optional(),
    district: model.string().optional(),
    country: model.string(),
  },
  { name: 'Address' },
)
type Address = model.Infer<typeof Address>

const User = () =>
  model.entity({
    id: model.integer(),
    name: model.string().optional(),
    email: model.email(),
    address: Address.optional(),
    posts: model.array(Post),
  })
type User = model.Infer<typeof User>

const Post = () =>
  model.entity({
    id: model.integer(),
    createdAt: model.datetime(),
    updatedAt: model.datetime(),
    title: model.string({ maxLength: 200 }),
    content: model.string({ maxLength: 5000 }).optional(),
    author: User,
  })
type Post = model.Infer<typeof Post>
```

## TypeScript support

Mondrian Framework is entirely written in TypeScript. The use of typing greatly reduces the error rate and allows for increased productivity thanks to seamless integration with modern IDEs that provide powerful autocomplete features.

As shown in the previous example, by importing the `@mondrian-framework/model` module, we have access to a wide range of functions suggested by the IDE, enabling us to describe a model.

Furthermore, through the use of constructs such as conditional types and mapped types, it is possible to automatically generate the TypeScript type of a model based on its schema. As demonstrated in the example, it is sufficient to use the `Infer` utility type.
