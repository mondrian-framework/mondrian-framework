# Encode

As anticipated in the previous chapter, Mondrian can also automatically encode
values of any given type. Every Mondrian type has a method `encode` to do
that, let's look into it:

```ts showLineNumbers
const Model = model.string()
const encodingResult = Model.encode('foo')
// -> ok("foo")
```

The result of the encoding process has type `Result`, a special type
that is returned by functions that may fail with some kind of error.

In the case of encoding, the value gets validated before being encoded. Since
the process of validation may fail for invalid values, encoding can fail as well
if you try to encode a value that is not valid.

Let's look at an example:

```ts showLineNumbers
type NonNegativeNumber = model.Infer<typeof NonNegativeNumber> // -> inferred as number
const NonNegativeNumber = model.number({ minimum: 0 })

NonNegativeNumber.encode(10) // -> ok(10)
NonNegativeNumber.encode(-1) // -> error([ assertion: "expected a number >= 0", got: -1, path: "$" ])
```

Additional assertions described in the type options do not change the
inferred type, so it is not possible to statically check that values of the
inferred type respect those invariants: it is the encoder's job to make sure an
invalid value never gets encoded.

In the previous example, `NonNegativeNumber` is inferred as a simple
Typescript `number`, so the `encode` method has to check that it is a
non-negative number. When given a negative number the encoding process fails
with an error describing what went wrong.

## A small introduction on the `Result` type

Since `encode`'s return type is a `Result`, it may be useful to take a
moment and get a feeling of how you can work with this kind of values.
All the useful definitions can be imported from the `result` namespace of
`@mondrian-framework/model`:

```ts showLineNumbers
import { result } from '@mondrian-framework/model'
```

A `Result<A, E>` is the return type of a function that may either fail with an
error of type `E`, or succeed producing a value of type `A`.

### Building a `Result`

To build a value of type `Result` you can use the two functions `result.ok`
and `result.fail`:

```ts showLineNumbers
const success = result.ok(10)
const failure = result.fail('error!')
```

Consider for example a function that performs safe division, returning
an error if the dividend is 0 instead of returning `Infinity`. It could be
implemented using `Result`:

```ts showLineNumbers
function safeDivide(dividend: number, divisor: number): result.Result<number, string> {
  return divisor === 0 ? result.fail('Division by 0') : result.ok(dividend / divisor)
}
```

### Working with `Result`s

The great advantage provided by the result type is that it _forces_ you to deal
with the error case, focusing your attention not only on the happy path but also
on what could go wrong.

To get a value out of a `Result` one must first check wether it is successful or
not:

```ts showLineNumbers
function printResult(res: Result<number, string>) {
  // highlight-start
  if (res.isOk) {
    // highlight-end
    // If `isOk` is true, you can access the `.value` property with type
    // of the successful result
    console.log(`success: ${res.value}`)
  } else {
    // If `isOk` is false, you can access the `.error` property with type
    // of the failing result
    console.log(`error: ${res.error}`)
  }
}

printResult(safeDivide(10, 2)) // -> success: 5.0
printResult(safeDivide(10, 0)) // -> error: "Division by 0"
```

The `Result` interface also has a lot of utility methods to make it easier to
work with those, you can have a look at their documentation and examples.

## Working with sensitive data

Encoding can be useful if you need to share data in JSON format, or if you need
to turn the JSON into any other kind of data structure. However, sometimes you
may wish to be a bit more nuanced with _what_ data gets included in the final
encoded value.

Imagine you're working with some sensitive data that you need to hide _before_
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

In this example every single field ends up encoded in the final object, so we
end up sharing the user's secret.

One way to fix this problem is to remember to remove the sensitive data from
the encoded object; however, Mondrian can help you with that; you can update
the model definition by marking the field as `sensitive` and tell the encoder to
hide sensitive data.

This way, the encoder will always turn al sensitive data into `null` values:

```ts showLineNumbers
type User = model.Infer<typeof User>
const User = model.object({
    name: model.string(),
    // highlight-start
    secret: model.string().sensitive(),
    // highlight-end
})

const value = { name: "John", secret: "..." }
// highlight-start
const encoded = User.encode(value, { sensitiveInformationStrategy: "hide" })
// highlight-end
// -> { name: "John", secret: null }
logResponse(encoded) // Phew! We're safe and didn't share the secret
```

## Non biunivocal encoding

Until now, every example included an encoding process that do not make any transformation
to the data. So why is encoding needed if we don't want to hide sensitive information?

```ts showLineNumbers
type User = model.Infer<typeof User>
const User = model.object({
    name: model.string(),
    secret: model.string(),
})

const value = { name: "John", secret: "..." }
const encoded = User.encode(value)
// value and encoded has the same value { name: "John", secret: "..." }
// why encoding?
```

in the next example we'll se a type that will encode in a different value:

```ts showLineNumbers
type User = model.Infer<typeof User>
const User = model.object({
    name: model.string(),
    secret: model.string(),
    createdAt: model.timestamp()
})

const value = { name: "John", secret: "...", createdAt: new Date() }
const encoded = User.encode(value)
// -> {  name: "John", secret: "...", createdAt: 1700355790325 }
```

Now the `encoded` value can be safely converted to a json string by doing `JSON.stringify`.
