# Validation

Validating values against common constraints is another area where Mondrian's type
definitions are useful. Each type definition can include additional validation information
that can be used to check invariants beyond basic type correctness, which would be hard or impossible to enforce at
compile-time alone.

Before diving into the validation API, let's look at an example to
get a sense of how this works:

```ts showLineNumbers
type NonEmpty = model.Infer<typeof NonEmpty>
const NonEmpty = model.number().array({ minItems: 1 })

NonEmpty.validate([1, 2, 3]) // -> ok
NonEmpty.validate([]) // -> error([{ assertion: "array must have at least 1 items", got: 0, path: "$.length" }])
```

## How types get validated

### `NumberType`

The number type allows specifying options to perform validation:

- `maximum`: The upper bound (inclusive) for a number to be considered valid.
- `exclusiveMaximum`: Like `maximum`, but the upper bound is excluded.
- `minimum`: The lower bound (inclusive) for a number to be considered valid.
- `exclusiveMinimum`: Like `minimum`, but the lower bound is excluded.
- `isInteger`: If set to `true`, any floating-point number is rejected as invalid.

### `StringType`

The options allowed by strings to influence the validation process are:

- `regex`: A regular expression that all valid string values of this type must match.
- `maxLength`: The maximum length (inclusive) for a string to be considered valid.
- `minLength`: The minimum length (inclusive) for a string to be considered valid.

### `ArrayType`

The array type allows specifying options to perform validation:

- `minItems`: The minimum number of items (inclusive) for an array to be valid.
- `maxItems`: The maximum number of items (inclusive) for an array to be valid.

### Other types

Most other built-in types do not have options for additional validation
rules (an exception is [custom types](./01-definition.md#custom-types)). However, composite types like objects, unions,
optionals, and nullables behave as you would expect: for such a type to be valid,
all of its constituent parts or wrapped values must themselves be valid according to their own definitions:

```ts showLineNumbers
type User = model.Infer<typeof User>
const User = model.object({
  username: model.string({ minLength: 1 }),
})

User.validate({ username: '' }) // -> error([{ assertion: "string shorter than min length (1)", got: "", path: "$.username" }])
User.validate({ username: 'John' }) // -> ok
```

## Tweaking the validation process

Just like with encoding and decoding, the validation process can be tweaked by
providing additional options. The type for these options is defined in the
`validation` namespace:

```ts showLineNumbers
import { validation } from '@mondrian-framework/model'

const exampleOptions: validation.Options = {
  errorReportingStrategy: 'allErrors',
}
```

- `errorReportingStrategy`:
  - `"allErrors"`: The validator attempts to gather as many validation errors as possible before returning the failure result.
  - `"stopAtFirstError"` (Default): The validator fails and returns immediately upon encountering the first validation error.

```ts showLineNumbers
import { number } from '@mondrian-framework/model' // Assuming number is imported

const array = number({ minimum: 0 }).array()

array.validate([-1, 0, -2], { errorReportingStrategy: 'allErrors' })
// -> error([
//   { assertion: "number must be greater than or equal to 0", got: -1, path: "$[0]" },
//   { assertion: "number must be greater than or equal to 0", got: -2, path: "$[2]" },
// ])
```

## Validation, encoding and decoding

Now that you have a clearer picture of encoding, decoding, and validation,
you may start to notice the role validation plays in the encoding and decoding processes.

- The purpose of encoding is to turn a _valid_ value of a given type into a JSON representation. Therefore, it first needs
  to ensure that the value being encoded is actually valid according to the type definition. Otherwise, one might
  end up inadvertently encoding data that breaks important invariants.
- The purpose of decoding is to turn an unknown value into a _valid_, strongly-typed value. So,
  after checking that the input has the right basic structure (e.g., it's an
  object with the required fields), it also needs to validate it against all constraints.
  Otherwise, one might end up with a value that, while structurally correct, breaks important semantic invariants.

There's an escape hatch you can use when you're 100% sure that you don't
need validation during encoding or decoding: the
`encodeWithoutValidation` and `decodeWithoutValidation` methods.

These two methods do exactly what their names imply: they perform encoding/decoding,
**skipping all validation checks** defined in the type options.

> **Warning:** It is highly discouraged to use these methods. Even if you are certain that
> you don't need validation for your current use case, requirements may change in the future. Forgetting that you bypassed
> validation could allow subtle bugs related to invalid data to enter your codebase.
>
> Consider this scenario:
> ```ts showLineNumbers
> import { model } from '@mondrian-framework/model' // Assuming model is imported
> declare function saveUserToDB(username: string): Promise<number>; // Placeholder
>
> // Initial definition
> const Username = model.string()
> type Username = model.Infer<typeof Username>
> // ... other imports/definitions ...
>
> async function registerNewUser(input: { username: Username }) {
>   // UNSAFE: Bypasses any validation defined on Username
>   const encodedResult = Username.encodeWithoutValidation(input.username)
>   if (!encodedResult.isOk) throw new Error("Unexpected encoding error"); // Basic check, but no validation
>   const encoded = encodedResult.value;
>   const id = await saveUserToDB(encoded as string) // Assume DB expects string
>   return id
> }
> ```
>
> Some time later, you realize there's a bug: users shouldn't be allowed to
> register with an empty string as their username. You add the validation constraint:
>
> ```ts showLineNumbers
> // Updated definition
> const Username = model.string({ minLength: 1 })
> type Username = model.Infer<typeof Username>
>
> // ... function remains the same ...
> async function registerNewUser(input: { username: Username }) {
>   const encodedResult = Username.encodeWithoutValidation(input.username) // Still bypasses validation!
>   if (!encodedResult.isOk) throw new Error("Unexpected encoding error");
>   const encoded = encodedResult.value;
>   const id = await saveUserToDB(encoded as string)
>   return id
> }
> ```
>
> This change is **not enough**! Users will still be able to register with
> an empty string because `encodeWithoutValidation` ignores the new `minLength: 1` constraint.
>
> If `.encode` had been used from the beginning, the code would need to handle the `Result` properly, making the validation failure apparent:
>
> ```ts showLineNumbers
> import { model, result } from '@mondrian-framework/model' // Assuming imports
> declare function saveUserToDB(username: string): Promise<number>; // Placeholder
> declare const logger: { logError: (msg: string, err: unknown) => void }; // Placeholder logger
>
> // Updated definition with validation
> const Username = model.string({ minLength: 1 })
> type Username = model.Infer<typeof Username>
>
> // Corrected function using .encode
> async function registerNewUser(input: { username: Username }): Promise<number | undefined> {
>   const encodedUsernameResult = Username.encode(input.username)
>
>   if (encodedUsernameResult.isOk) {
>     // encodedUsernameResult.value is guaranteed to be a non-empty string here
>     const id = await saveUserToDB(encodedUsernameResult.value)
>     return id
>   } else {
>     // Handles the case where input.username is empty or otherwise invalid
>     logger.logError('Invalid username input', encodedUsernameResult.error)
>     return undefined // Indicate failure
>   }
> }
> ```
