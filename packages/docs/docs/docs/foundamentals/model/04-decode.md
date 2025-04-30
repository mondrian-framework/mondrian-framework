# Decode

The Mondrian framework can also help you automatically decode unknown data into a strongly-typed value that conforms
to a given type definition. Every Mondrian type provides a `decode` method that
accepts an `unknown` value. It returns a `Result` containing either the decoded value conforming to the
type definition (and its inferred TypeScript type), or an array of errors detailing why the decoding failed.

If you've already read the previous chapter about [encoding](./03-encode.md),
you should be familiar with the `Result` type; otherwise,
reviewing that section might help in understanding the following examples.

## The `decode` method

Let's look at an example of how decoding works for a Mondrian type:

```ts showLineNumbers
type SearchQuery = model.Infer<typeof SearchQuery>
const SearchQuery = model.object({
  name: model.string(),
  limit: model.number().optional(),
  skip: model.number().optional(),
})

// Imagine this value comes from an HTTP request, or anywhere else:
// it actually is unknown and we have to decode it
const rawQuery: unknown = { name: 'Mondrian', skip: 10 }
SearchQuery.decode(rawQuery) // -> ok({ name: "Mondrian", skip: 10 })

const rawWrongQuery: unknown = { skip: 10, limit: 5 }
SearchQuery.decode(rawWrongQuery) // -> error([ { expected: string, got: undefined, path: "$.name" } ])
```

If you inspect the `decode` method's return type (`result.Result<Infer<T>, (decoding.Error | validation.Error)[]>`), you'll see that it returns
a result whose error type is an array of either `decoding.Error` or `validation.Error`. This reflects the two-stage process of decoding:

1.  **Decoding**: First, it checks that the input value has the expected structure and basic types defined by the Mondrian type. For example, if the model is an object, the decoder expects to find all required fields with the correct basic types (e.g., string, number).
2.  **Validation**: Second, if the basic structure is correct, it performs further validation based on the type's constraints (e.g., `minimum`, `maxLength`, custom validation rules) to ensure the value adheres to all specified rules.

A failure can occur in either stage.

```ts showLineNumbers
type NonNegativeNumber = model.Infer<typeof NonNegativeNumber>
const NonNegativeNumber = model.number({ minimum: 0 })

NonNegativeNumber.decode('not-a-number')
// -> error([{ expected: "a number", got: "not-a-number", path: "$" }]) // Fails in decoding stage

NonNegativeNumber.decode(-1)
// -> error([{ assertion: "number must be greater than or equal to 0", got: -1, path: "$" }]) // Fails in validation stage

NonNegativeNumber.decode(10)
// -> ok(10)
```

## Tweaking the decoding process

You can provide an optional configuration object to the `decode` method to tweak its behavior.
The options are defined in the `decoding.Options` type within the `@mondrian-framework/model` package.

An example configuration could be:

```ts showLineNumbers
import { decoding } from '@mondrian-framework/model'

const options: decoding.Options = {
  typeCastingStrategy: 'tryCasting', // or "expectExactTypes"
  fieldStrictness: 'expectExactFields', // or "allowAdditionalFields"
  errorReportingStrategy: 'allErrors', // or "stopAtFirstError"
}
```

- `typeCastingStrategy`:
  - `"tryCasting"`: The decoder attempts common type casts (e.g., string to number, number to boolean) before failing if it encounters an unexpected type. For example, when decoding a number, if the decoder encounters a string, it will try to parse it as a number.
  - `"expectExactTypes"` (Default): The decoder fails immediately if the input type doesn't match the expected type exactly.
- `fieldStrictness` (Applies to object decoding):
  - `"allowAdditionalFields"`: The decoder ignores any fields present in the input object that are not defined in the Mondrian object type.
  - `"expectExactFields"` (Default): The decoder fails if the input object contains any fields not declared in the Mondrian type definition.
- `errorReportingStrategy`:
  - `"allErrors"`: The decoder attempts to gather all possible decoding and validation errors before returning the failure result.
  - `"stopAtFirstError"` (Default): The decoder fails and returns immediately upon encountering the first error.

Here's an example using `errorReportingStrategy`:

```ts showLineNumbers
const array = model.number({ minimum: 0 }).array()

array.decode([-1, 0, -2], { errorReportingStrategy: 'allErrors' })
// -> error([
//   { assertion: "number must be greater than or equal to 0", got: -1, path: "$[0]" },
//   { assertion: "number must be greater than or equal to 0", got: -2, path: "$[2]" },
// ])

array.decode([-1, 0, -2], { errorReportingStrategy: 'stopAtFirstError' })
// -> error([
//   { assertion: "number must be greater than or equal to 0", got: -1, path: "$[0]" },
// ])
```

Here's an example using `typeCastingStrategy`:

```ts showLineNumbers
const array = model.number({ minimum: 0 }).array()

array.decode(['10', 20, '30.0'], { typeCastingStrategy: 'tryCasting' })
// -> ok([10, 20, 30])

array.decode(['10', 20, '30.0'], { typeCastingStrategy: 'expectExactTypes' })
// -> error([
//   { expected: "a number", got: "10", path: "$[0]" },
// ])
// (only one error because the default errorReportingStrategy is stopAtFirstError)
```

Here's an example using `fieldStrictness`:

```ts showLineNumbers
const obj = model.object({ a: model.number() })

obj.decode({ a: 1, b: 2 }, { fieldStrictness: 'allowAdditionalFields' })
// -> ok({ a: 1 })

obj.decode({ a: 1, b: 2 }, { fieldStrictness: 'expectExactFields' })
// -> error([
//   { expected: "undefined", got: "2", path: "$.b" },
// ])
```
