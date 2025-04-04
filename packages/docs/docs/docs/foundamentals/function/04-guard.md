# Guard

Guards are specialized constructs in Mondrian designed to run checks or logic _before_ the main body of a function executes. They are ideal for implementing cross-cutting concerns like authentication, authorization, rate limiting, or preliminary input validation that determines if the function should proceed at all.

Unlike [Providers](./03-provider.md), which primarily supply resources or context _during_ function execution, Guards act as gatekeepers, potentially preventing the function's core logic from running based on their outcome.

## Definition

Defining a guard is similar to defining a provider, using the `guard` builder from the `@mondrian-framework/module` package.

```ts showLineNumbers
import { result } from '@mondrian-framework/model'
import { guard, error } from '@mondrian-framework/module'

// Define potential errors the guard can return
const guardErrors = error.define({
  unauthorized: { message: 'Unauthorized access' },
  rateLimited: { message: 'Too many requests' },
})

// Define the input the guard needs from the module/runtime context
type AuthInput = { authorization?: string }

// Build the guard
export const authenticationGuard = guard.build({
  errors: { unauthorized: guardErrors.unauthorized },
  body: async ({ authorization }: AuthInput) => {
    if (!authorization || !isValidToken(authorization)) {
      // If the check fails, return a failure result
      return result.fail({ unauthorized: {} })
    }
    // If the check passes, return an empty success result.
    return result.ok()
  },
})

// Placeholder functions for the example
declare function isValidToken(token: string): boolean
declare function decodeToken(token: string): { userId: string }
```

A guard's `body` function receives input derived from the module's context and must return a `result`.

- A `result.fail` indicates the guard check failed, and the main function body **will not** be executed. The error is propagated back to the caller.
- A `result.ok` indicates the guard check passed, and the function execution proceeds. Unlike providers, successful guards typically return `result.ok()` without a value, signalling permission to proceed without injecting additional data into the function's arguments.

## Usage

Guards are applied to a function definition using the `.use()` method, specifically within the `guards` property.

```ts showLineNumbers
import { authenticationGuard } from './guards'
import { model, result } from '@mondrian-framework/model'
import { functions } from '@mondrian-framework/module'

const sensitiveData = model.object({ secret: model.string() })

const getSensitiveDataDefinition = functions.define({
  output: sensitiveData,
  errors: { unauthorized: authenticationGuard.errors.unauthorized }, // Declare guard's errors
})

const getSensitiveData = getSensitiveDataDefinition
  // highlight-start
  .use({ guards: { auth: authenticationGuard } })
  // highlight-end
  .implement({
    // highlight-start
    // Since the guard returns result.ok(), no additional arguments are injected.
    // The 'auth' key exists due to the naming in .use(), but holds no value from the guard.
    async body(
      {
        /* auth is present but empty */
      },
    ) {
      // highlight-end
      console.log('User passed authentication guard.')
      // Fetch and return sensitive data...
      // highlight-start
      const data = await retrieveGeneralSensitiveData()
      // highlight-end
      return result.ok(data)
    },
  })

// Placeholder function
// highlight-start
declare function retrieveGeneralSensitiveData(): Promise<{ secret: string }>
// highlight-end
```

In this example, the `authenticationGuard` runs before the `getSensitiveData` function's body. If authentication fails, the guard returns `result.fail({ unauthorized: {} })`, execution stops, and the error is returned. If authentication succeeds, the guard returns `result.ok()`, and the function's `body` is executed without any additional arguments injected from the guard.

## Dependencies and Errors

Similar to providers, guards can:

- Depend on other providers using the `.use({ providers: { ... } })` method when building the guard.
- Declare and return specific `errors`. Any errors declared by a guard **must also be declared** in the `errors` definition of the function that uses the guard. This ensures the function's contract accurately reflects all possible failure outcomes.

Guards provide a powerful mechanism for enforcing preconditions and security constraints consistently across multiple functions within a module.
