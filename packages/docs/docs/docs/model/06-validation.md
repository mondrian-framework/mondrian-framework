# Validation

Validation of common types is another piece of work where Mondrian's type
definitions can come in handy: each type can take additional information that
can be used to check additional invariants that would be hard to enforce at
compile-time.

Before diving deep into the validation API, let's take a look at an example to
get a sense of how this works:

```ts showLineNumbers
type NonEmpty = types.Infer<typeof nonEmpty>
const nonEmpty = types.number().array({ minItems: 1 })

nonEmpty.validate([1, 2, 3]) // -> ok
nonEmpty.validate([]) // -> error([{ assertion: ".length >= 1", got: [], path: "$" }])
```

## How types get validated

### `NumberType`

The number type allows to specify some options to perform validation:

- `maximum`: the upper bound (inclusive) for a number to be considered valid
- `exclusiveMaximum`: like `maximum`, but the upper bound is excluded
- `minimum`: the lower bound (inclusive) for a number to be considered valid
- `exclusiveMinimum`: lime `minimum`, but the lower bound is excluded
- `isInteger`: if set to `true` any floating point number is rejected as invalid

### `StringType`

The options allowed by strings to influence the validation process are:

- `regex`: a regex that all valid members of this type must respect
- `maxLength`: the maximum length (inclusive) for a string to be considered valid
- `minLength`: the minimum length (inclusive) for a string to be consedered valid

### `ArrayType`

The array type allows to specofy some options to perform validation:

- `minItems`: the minimum number of items (inclusive) for an array to be valid
- `maxItems`: the maximum number of items (inclusive) for an array to be valid

### Other types

All other types do not have additional options to allow for additional validation
rules (there's an exception for custom types, you can read more about those
[here](./07-custom-types.md)). However, composed types like objects, unions,
optionals, and nullables behave like you would expect: for such a type to be valid
all of their wrapped items must themselves be valid:

```ts showLineNumbers
type User = types.Infer<typeof user>
const user = types.object({
    username: types.string({ minLength: 1 }),
})

user.validate({ username: "" }) // -> error([{ assertion: ".length >= 1", got: "", path: "$.username" }])
user.validate({ username: "Giacomo" }) // -> ok
```

## Tweaking the validation process

Just like with encoding and decoding, the validation process can be tweaked by
providing it additional options. The type for those options is defined in the
`validation` namespace:

```ts showLineNumbers
import { validation } from "@mondrian-framework/model"

const exampleOptions: validation.Options = {
    errorReportingStrategy: "allErrors"
}
```

- `errorReportingStrategy`: can be set to `"allErrors"` if you want the decoder
  to try and gather as many errors as possible before failing.
  The default is `"stopAtFirstError"`, so the decoding immediately fails as soon
  as the first error is encountered

```ts showLineNumbers
const array = number({ minimum: 0 }).array()

array.validate([-1, 0, -2], { errorReportingStrategy: "allErrors" })
// -> error([
//   { assertion: ">= 0", got: -1, path: "$[0]" },
//   { assertion: ">= 0", got: -2, path: "$[2]" },
// ])
```
