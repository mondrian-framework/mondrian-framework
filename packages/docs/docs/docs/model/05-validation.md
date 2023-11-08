# Validation

Validation of common types is another piece of work where Mondrian's type
definitions can come in handy: each type can take additional information that
can be used to check additional invariants that would be hard to enforce at
compile-time.

Before diving deep into the validation API, let's take a look at an example to
get a sense of how this works:

```ts showLineNumbers
type NonEmpty = model.Infer<typeof NonEmpty>
const NonEmpty = model.number().array({ minItems: 1 })

NonEmpty.validate([1, 2, 3]) // -> ok
NonEmpty.validate([]) // -> error([{ assertion: ".length >= 1", got: [], path: "$" }])
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
[here](./06-custom-types.md)). However, composed types like objects, unions,
optionals, and nullables behave like you would expect: for such a type to be valid
all of their wrapped items must themselves be valid:

```ts showLineNumbers
type User = model.Infer<typeof User>
const User = model.object({
  username: model.string({ minLength: 1 }),
})

User.validate({ username: '' }) // -> error([{ assertion: ".length >= 1", got: "", path: "$.username" }])
User.validate({ username: 'Giacomo' }) // -> ok
```

## Tweaking the validation process

Just like with encoding and decoding, the validation process can be tweaked by
providing it additional options. The type for those options is defined in the
`validation` namespace:

```ts showLineNumbers
import { validation } from '@mondrian-framework/model'

const exampleOptions: validation.Options = {
  errorReportingStrategy: 'allErrors',
}
```

- `errorReportingStrategy`: can be set to `"allErrors"` if you want the decoder
  to try and gather as many errors as possible before failing.
  The default is `"stopAtFirstError"`, so the decoding immediately fails as soon
  as the first error is encountered

```ts showLineNumbers
const array = number({ minimum: 0 }).array()

array.validate([-1, 0, -2], { errorReportingStrategy: 'allErrors' })
// -> error([
//   { assertion: ">= 0", got: -1, path: "$[0]" },
//   { assertion: ">= 0", got: -2, path: "$[2]" },
// ])
```

## Validation, encoding and decoding

Now that you have a clearer picture of the encoding, decoding, and validation
you may start to notice the role validation plays in encoding and decoding.

- The purpose of encoding is turning a _valid_ type into a JSON, so it first needs
  to make sure that the type it's encoding is actually valid, otherwise one may
  end up inadvertently encoding some type that breaks important invariants
- The purspose of decoding is turning an unknown value into a _valid_ type. So,
  after checking that it has the right structure (for example, that it's an
  object with the required fields), it also needs to validate it.
  Otherwise one may end up using a value that breaks important invariants

There's an escape hatch that you can use when you're 100% sure that you don't
need validation in the encoding and decoding processes: the
`encodeWithoutValidation` and `decodeWithoutValidation`.

Those two methods do exactly what you'd expect: they perform encoding/decoding
skipping all the validation checks.

> It is highly discouraged to use these methods. Even if you are 100% sure that
> you are never going to need validation for your custom types: your current
> requirements may change in the future and you may have forgetten you're not
> validating your data allowing sneaky bugs to enter your codebase.
>
> ```ts showLineNumbers
> type Username = model.Infer<typeof Username>
> const Username = model.string()
>
> type User = model.Infer<typeof User>
> const User = model.object({ id: model.number(), username })
>
> async function registerNewUser(input: { username: Username }) {
>   const encoded = Username.encodeWithoutValidation(input.username) // <- this is super unsafe
>   const id = await saveUserToDB(encoded)
>   return id
> }
> ```
>
> Some time later you realise that theres' a bug: users shouldn't be allowed to
> register with an empty string as username, so you add further validation:
>
> ```ts showLineNumbers
> type Username = model.Infer<typeof Username>
> // highlight-start
> const Username = model.string({ minLenght: 1 })
> // highlight-end
>
> type User = model.Infer<typeof User>
> const User = model.object({ id: model.number(), username })
>
> async function registerNewUser(input: { username: Username }) {
>   const encoded = Username.encodeWithoutValidation(input.username)
>   const id = await saveUserToDB(encoded)
>   return id
> }
> ```
>
> This change is not enough, though: users will still be able to register with
> an empty string as their username! Can you see why? Since we were using
> `.encodeWithoutValidation` we didn't check any additional invariant (for
> example that the string is not empty).
>
> If we used `.encode` from the beginning, we would have been forced from the
> compiler to handle any possible error case and wouldn't have missed that:
>
> ```ts showLineNumbers
> async function registerNewUser(input: { username: Username }) {
>   const encodedUsername = Username.encode(input.username)
>   if (encodedUsername.isOk) {
>     const id = await saveUserToDB(encoded)
>     return id
>   } else {
>     logger.log(LogKind.Error, 'invalid input', encodedUsername.error)
>     return undefined
>   }
> }
> ```
