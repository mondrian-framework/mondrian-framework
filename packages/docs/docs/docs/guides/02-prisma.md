# Prisma ORM Integration

Mondrian Framework offers seamless integration with [Prisma](https://www.prisma.io/), a popular TypeScript ORM. This integration simplifies exposing your database models through your API, especially when using Mondrian's `retrieve` capabilities for complex data fetching like filtering, sorting, pagination, and field selection.

The key benefit is **type safety**: Mondrian automatically generates TypeScript types for the `retrieve` argument in your function implementations that are directly compatible with Prisma's query arguments (like those for `findMany`, `findUnique`, etc.). This eliminates guesswork and reduces runtime errors.

## Example: Exposing User and Post Models

Let's walk through an example of defining Prisma models, corresponding Mondrian entities, and a function to retrieve users with their posts.

### 1. Prisma Schema

Define your models in your `schema.prisma` file:

```prisma showLineNumbers
// schema.prisma
model User {
  id       String @id @default(auto()) @map("_id") @db.ObjectId
  email    String @unique
  password String // Note: Password should likely be omitted in API responses
  posts    Post[]
}

model Post {
  id       String @id @default(auto()) @map("_id") @db.ObjectId
  content  String
  authorId String @db.ObjectId
  author   User   @relation(fields: [authorId], references: [id])
}
```

### 2. Mondrian Entity Definitions

Define corresponding Mondrian entities. Use `model.entity` to mark them as domain entities and lazy evaluation (`() => ...`) to handle circular dependencies between `User` and `Post`.

```ts showLineNumbers
// types.ts
import { model } from '@mondrian-framework/model'

// highlight-start
// Use lazy evaluation for related entities
const User = () =>
  model.entity({
    id: model.string(),
    email: model.string(),
    // password field is omitted for security
    posts: model.array(Post), // Reference the Post entity
  })

const Post = () =>
  model.entity({
    id: model.string(),
    content: model.string(),
    author: User, // Reference the User entity
  })
// highlight-end
```

It's crucial to define relationships (`posts` in `User`, `author` in `Post`) if you want to enable graph traversal in your API (e.g., via GraphQL).

### 3. Mondrian Function Definition

Define a function that retrieves users. Enable the desired `retrieve` capabilities.

```ts showLineNumbers
// functions.ts
import { User } from './types'
import { model } from '@mondrian-framework/model'
import { functions } from '@mondrian-framework/module'

// Import the lazy User entity

const getUsers = functions.define({
  output: model.array(User), // Output an array of Users
  // highlight-start
  // Enable retrieve capabilities based on the User entity
  retrieve: { select: true, where: true, orderBy: true, skip: true, take: true },
  // highlight-end
  // ... potentially add errors, providers, etc.
})
```

Mondrian will automatically generate the structure for the `retrieve` argument based on the fields and capabilities defined in the `User` entity model.

### 4. Function Implementation

Implement the function. The `retrieve` argument passed to the `body` function will have a type compatible with Prisma's `findMany` arguments.

```ts showLineNumbers
// functions.ts
import { result } from '@mondrian-framework/model'
import { PrismaClient } from '@prisma/client'

// Assuming prisma client instance

const prisma = new PrismaClient() // Replace with your Prisma client instantiation/injection logic

// ... getUsers definition ...

const getUsersImpl = getUsers.implement({
  // highlight-start
  async body({ retrieve }) {
    // The 'retrieve' object type matches Prisma's findMany arguments:
    // { select?: ..., where?: ..., orderBy?: ..., skip?: ..., take?: ... }
    const users = await prisma.user.findMany(retrieve)
    return result.ok(users)
  },
  // highlight-end
})
```

Because `retrieve` is typed correctly according to the `User` entity and the enabled capabilities, you can pass it directly to `prisma.user.findMany()`, ensuring type safety between your API layer and database queries.

## Exposing via Runtimes

When you expose this `getUsers` function via a runtime like GraphQL (`@mondrian-framework/graphql-yoga`) or REST (`@mondrian-framework/rest-fastify`), the `retrieve` capabilities are translated into the respective API standards:

- **GraphQL**: Arguments for `where`, `orderBy`, `skip`, `take`, and the ability to select specific fields in the query body.
- **REST**: Typically mapped to query parameters (e.g., `?select[id]=true&select[email]=true&where[email][contains]=@example.com&skip=10&take=20`). The exact mapping depends on the REST adapter configuration.

This allows clients to perform complex data fetching operations defined in your Mondrian function through standard API protocols, while leveraging Prisma efficiently on the backend.

Remember to implement proper [Security Policies](./01-security.md) to protect sensitive fields and control data access when exposing entities with `retrieve` capabilities.
