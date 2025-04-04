# Security

Mondrian Framework offers powerful features for securing your data, especially when dealing with functions that expose parts of your data model through `retrieve` capabilities. Without proper security, exposing complex data graphs can inadvertently lead to data breaches, where callers might access sensitive information they shouldn't see.

Mondrian's security model focuses on defining access policies at the module level, allowing fine-grained control over which parts of your entities are accessible based on the execution context.

## Module Policies

Security policies are defined within the `implement` phase of a module definition using the `policies` function. This function receives the module's context as input and returns a set of security rules.

```ts showLineNumbers
import { Context } from './context'
// Assuming policies are defined elsewhere
import { moduleDefinition } from './module-definition'
import { policies } from './security-policies'
import { module, security } from '@mondrian-framework/module'

// Assuming a context type is defined

const moduleImplementation = moduleDefinition.implement({
  // ... other implementation details (functions, context builder)
  // highlight-start
  policies(context: Context) {
    // Determine the policy based on the context (e.g., user authentication status)
    if (context.userId != null) {
      // Return policies for authenticated users
      return policies.loggedUser(context.userId)
    } else {
      // Return policies for guests or unauthenticated users
      return policies.guest
    }
  },
  // highlight-end
})
```

The core idea is that the context built for each request determines the set of security rules applied to that specific request.

## Defining Policy Rules

Policies are constructed using the `security` builder from `@mondrian-framework/module`. The primary method is `.on(EntityType)`, which specifies the entity these rules apply to, followed by `.allows(...)` to define permissions.

```ts showLineNumbers
import { User, Post } from './model'
import { module, security } from '@mondrian-framework/module'

// Assuming User and Post entity types are defined

// Example policy definitions (could be in a separate file like './security-policies.ts')
const loggedUserPolicies = (userId: string) =>
  security
    // Rules for the User entity
    // highlight-start
    .on(User)
    // Rule 1: Allows reading all fields if the user is accessing their own record
    .allows({ selection: true, restriction: { id: { equals: userId } } })
    // Rule 2: Otherwise, only allow reading 'id' and 'email' fields
    .allows({ selection: { id: true, email: true } })
    // Rules for the Post entity
    .on(Post)
    // Allow reading all fields of any post for logged-in users
    .allows({ selection: true })
// highlight-end

const guestPolicies = security
  // Rules for the User entity for guests
  // highlight-start
  .on(User)
  // Guests can only see the 'id' field
  .allows({ selection: { id: true } })
  // Rules for the Post entity for guests
  .on(Post)
  // Guests can only see the 'id' field
  .allows({ selection: { id: true } })
// highlight-end

export const policies = {
  loggedUser: loggedUserPolicies,
  guest: guestPolicies,
}
```

### `allows` Parameters

The `allows` method takes an object with two optional keys:

1.  `selection`: Defines which fields of the entity can be read (projection).
    - `true`: Allows selection of all fields defined in the entity's model.
    - `{ field1: true, field2: true, ... }`: Allows selection only of the specified fields. Fields not listed or set to `false` cannot be selected.

2.  `restriction`: Defines conditions that must be met for the `selection` rule to apply (filtering). The structure mirrors the `where` clause used in `retrieve` capabilities, allowing checks like `{ id: { equals: userId } }` or `{ status: { in: ['published', 'archived'] } }`. If omitted, the `selection` applies unconditionally (within the context of the policy).

You can chain multiple `.allows()` calls for the same entity. The framework evaluates them in order: the first rule whose `restriction` is met determines the allowed `selection`. If a restriction is defined, it must be satisfied by the data being accessed for the selection to be permitted.

## How Policies are Applied

When a Mondrian function with `retrieve` capabilities is executed, the framework automatically:

1.  Builds the module context.
2.  Calls the `policies` function with the context to get the applicable security rules.
3.  Analyzes the requested `select` and `where` clauses (if provided by the caller).
4.  Filters and restricts the data access based on the defined policies _before_ returning the result. If a requested selection violates the policy, the framework prevents the data leakage. If a requested item doesn't match any `allows` rule's restriction, it's filtered out.

This ensures that regardless of what the client requests via `select` or `where`, the security policies defined at the module level are enforced consistently.

You can find a more complex example of security policies in the example package within the Mondrian repository (`packages/example/src/core/security-policies.ts`).
