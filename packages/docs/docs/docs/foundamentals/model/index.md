---
sidebar_position: 2.1
---

# Model

The first and fundamental feature of the Mondrian Framework is the ability to
define the **schema** of a domain model. This definition is a prerequisite to
enable data translation into any current and future representations.
Having a detailed domain model defined in a formal language is a powerful tool in
itself for ensuring interoperability and longevity.

The schema definition approach means that the developer does not
directly write the TypeScript types representing their domain model. Instead, they start by
defining the schema, which can contain additional information beyond what is typically
supported by the target programming language, such as validation rules.
TypeScript types are then automatically inferred by the framework from the
schema and provided to the user, ready to use.

Mondrian Framework takes inspiration from various libraries for declaring and
validating data models, such as [Zod](https://zod.dev/),
[io-ts](https://github.com/gcanti/io-ts), [Ajv](https://ajv.js.org/),
[typia](https://typia.io/), and many others.
It tries to combine their expressiveness, speed, and ease of use while adding features
not only to declare and validate a schema but also to easily visit, process it,
and work with data projections.

Essentially, a model schema:

- Represents an entity of the application domain, in terms of data type,
  encoding, decoding, and validation rules.
- Is defined using a collection of convenient framework functions to declare
  fields and their attributes.
- Provides generated TypeScript type definitions.

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

Mondrian Framework is entirely written in TypeScript. The use of strong typing greatly reduces the error rate and increases productivity thanks to seamless integration with modern IDEs that provide powerful autocompletion features.

As shown in the previous example, by importing the `@mondrian-framework/model` module, we gain access to a wide range of functions enabling us to describe a model. Furthermore, it is possible to automatically generate the TypeScript type of a model based on its schema. As demonstrated in the example, using the `Infer` utility type is sufficient for this purpose.
