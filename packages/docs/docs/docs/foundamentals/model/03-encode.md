# Encode

As anticipated in the previous chapter, Mondrian can automatically encode
values of any given type definition into a JSON-compatible representation. Every Mondrian type has an `encode` method for
this purpose. Let's look into it:

```ts showLineNumbers
const Model = model.string()
const encodingResult = Model.encode('foo')
// -> ok("foo")
```

The result of the encoding process is a `Result` type (`result.Result<JSONType, ErrorType>`), a special type
that represents the outcome of functions that may fail with some kind of error.

In the case of encoding, the input value is first validated against the type definition before being encoded. Since
the process of validation may fail for invalid values, encoding can also fail
if you attempt to encode a value that is not valid according to the type's rules.

Let's look at an example:

```ts showLineNumbers
type NonNegativeNumber = model.Infer<typeof NonNegativeNumber> // -> inferred as number
const NonNegativeNumber = model.number({ minimum: 0 })

NonNegativeNumber.encode(10) // -> ok(10)
NonNegativeNumber.encode(-1) // -> error([ assertion: "expected a number >= 0", got: -1, path: "$" ])
```

Additional validation constraints described in the type definition (like `minimum: 0`)
do not change the inferred TypeScript type (`number` in this case).
Therefore, it is not possible to statically check (at compile time) that values of the
inferred type respect those invariants. It is the encoder's job at runtime to ensure an
invalid value never gets successfully encoded.

In the previous example, `NonNegativeNumber` is inferred as a simple
TypeScript `number`, so the `encode` method must check at runtime that the input is actually
non-negative. When given a negative number, the encoding process fails
with an error describing what went wrong.

## The `Result` type

Since `encode`'s return type is a `Result`, it's useful to take a
moment and understand how you can work with these values.
All necessary definitions can be imported from the `result` namespace of
`@mondrian-framework/model`:

```ts showLineNumbers
import { result } from '@mondrian-framework/model'
```

A `result.Result<A, E>` represents the return type of a function that may either fail with an
error of type `E`, or succeed, producing a value of type `A`.

### Building a `Result`

To build a `Result` value, you can use the two functions `result.ok`
and `result.fail`:

```ts showLineNumbers
const success = result.ok(10)
const failure = result.fail('error!')
```

Consider, for example, a function that performs safe division, returning
an error if the divisor is 0 instead of returning `Infinity`. It could be
implemented using `Result`:

```ts showLineNumbers
function safeDivide(dividend: number, divisor: number): result.Result<number, string> {
  return divisor === 0 ? result.fail('Division by 0') : result.ok(dividend / divisor)
}
```

### Working with `Result`s

The great advantage provided by the `Result` type is that it _forces_ you to handle
the potential error case, focusing your attention not only on the happy path but also
on what could go wrong.

To get a value out of a `Result`, one must first check whether it is successful or
not using the `isOk` property:

```ts showLineNumbers
import { Result } from '@mondrian-framework/model' // Assuming Result type alias

function printResult(res: Result<number, string>) {
  // highlight-start
  if (res.isOk) {
    // highlight-end
    // If `isOk` is true, you can safely access the `.value` property, which has the
    // type of the successful result (A)
    console.log(`success: ${res.value}`)
  } else {
    // If `isOk` is false, you can safely access the `.error` property, which has the
    // type of the failure result (E)
    console.log(`error: ${res.error}`)
  }
}

printResult(safeDivide(10, 2)) // -> success: 5.0
printResult(safeDivide(10, 0)) // -> error: "Division by 0"
```

The `Result` interface also provides several utility methods (like `map`, `mapError`, `or`, etc.) to make working with them easier.
You can explore their documentation and examples for more details.

## Sensitive data

Encoding is useful if you need to share data in JSON format or convert it
to another data structure. However, sometimes you
may wish to be more nuanced about _what_ data gets included in the final
encoded value, especially with sensitive information.

Imagine you're working with sensitive data that you need to hide _before_
sharing the encoded JSON:

```ts showLineNumbers
type User = model.Infer<typeof User>
const User = model.object({
    name: model.string(),
    secret: model.string(),
})

const value = { name: "John", secret: "..." }
const encoded = User.encode(value) // -> { name: "John", secret: "..." }
logResponse(encoded) // Uh oh, we ended up sharing the secret value!
```

In this example, every field ends up encoded in the final object by default, so we
end up sharing the user's `secret`.

One way to fix this is to manually remove the sensitive data from
the encoded object after encoding. However, Mondrian provides a more declarative way: you can update
the model definition by marking the field as `.sensitive()` and then tell the encoder to
use a specific strategy for sensitive data.

For instance, using the `hide` strategy, the encoder will replace all sensitive data with `null` values:

```ts showLineNumbers
type User = model.Infer<typeof User>
const User = model.object({
    name: model.string(),
    secret: model.string().sensitive(),
})

const value = { name: "John", secret: "..." }
const encoded = User.encode(value, { sensitiveInformationStrategy: "hide" })
// -> { name: "John", secret: null }
logResponse(encoded) // Phew! We're safe and didn't share the secret
```

## Non-bijective Encoding

Until now, every example involved an encoding process that didn't significantly transform
the data structure (aside from hiding sensitive fields). So, why is encoding needed if the structure remains largely the same?

The need for encoding becomes clearer when dealing with types whose in-memory representation (the inferred TypeScript type) differs from their desired JSON representation. Let's look at an example with `model.timestamp()`:

```ts showLineNumbers
const User = model.object({
    name: model.string(),
    secret: model.string().sensitive(), // Mark secret as sensitive
    createdAt: model.timestamp() // Infers as Date
})
type User = model.Infer<typeof User> // { readonly name: string; readonly secret: string; readonly createdAt: Date; }

const value: User = { name: "John", secret: "...", createdAt: new Date() }

// Encode normally (no sensitive strategy)
const encodedDefault = User.encode(value)
// -> { isOk: true, value: { name: "John", secret: "...", createdAt: 1700355790325 } }

// Encode hiding sensitive data
const encodedHidden = User.encode(value, { sensitiveInformationStrategy: "hide" })
// -> { isOk: true, value: { name: "John", secret: null, createdAt: 1700355790325 } }
```

In this case, the `createdAt` field, which is a `Date` object in TypeScript (`model.Infer<typeof User>`), is encoded into a number (Unix timestamp in milliseconds) by the `model.timestamp()` encoder. This encoded value is now a primitive JSON type.

This transformation ensures the entire `encoded` object consists only of JSON-compatible types and can be safely passed to `JSON.stringify`.
