# Decode

The Mondrian framework can also help you automatically decode data that conforms
to a given type: every Mondrian type definition has a method `decode` that
accepts an unknown value and can either return a decoded value conforming to the
type definition, or a list of reasons why the decoding failed.

If you've already read the previous chapter about [encoding](./03-encode.md),
then you should already be familiar with the `Result` return type; otherwise,
go check it out, it will really help in understanding the following examples.

## The `decode` method

Let's look at an example of how decoding can work out for a Mondrian type:

```ts showLineNumbers
type SearchQuery = model.Infer<typeof SearchQuery>
const SearchQuery = model.object({
    name: model.string(),
    limit: model.number().optional(),
    skip: model.number().optional(),
})

// Imagine this value comes from an HTTP request, or anywhere else:
// it actually is unknown and we have to decode it
const rawQuery: unknown = { name: "Mondrian", skip: 10 }
SearchQuery.decode(rawQuery) // -> ok({ name: "Mondrian", skip: 10 })

const rawWrongQuery: unknown = { skip: 10, limit: 5 }
SearchQuery.decode(rawWrongQuery) // -> error([ { expected: string, got: undefined, path: "$.name" } ])
```

If you take a look at the `decode` method return type you'll see that it returns
a result whose error can be `decoding.Error[] | validation.Error[]`; this can
give us an insight into how the decoding process works:

- First, it checks that the value to decode conforms to the type's definition: it
  must be of the same inferred type (for example if the model is an object, like
  in the example above, the decoder expects to find all the required fields and
  those have the correct type)
- Second, it performs further validation based on the type's options to make
  sure that the value also respects those

```ts showLineNumbers
type NonNegativeNumber = model.Infer<typeof NonNegativeNumber>
const NonNegativeNumber = model.number({ minimum: 0 })

NonNegativeNumber.decode("not-a-number")
// -> error([{ expected: "a number", got: "not-a-number", path: "$" }])

NonNegativeNumber.decode(-1)
// -> error([{ assertion: ">= 0", got: -1, path: "$" }])

NonNegativeNumber.decode(10)
// -> ok(10)
```

## Tweaking the decoding process

You can also provide some additional options to tweak how the decoding process
works: the definition of those options can be found in the `decoding` namespace
of `"@mondrian-framework/model"`.

An example of a custom configuration could be:

```ts showLineNumbers
const options: decoding.Options = {
    typeCastingStrategy: "tryCasting", // or "expectExactTypes"
    errorReportingStrategy: "allErrors", // or "stopAtFirstError"
}
```

- `typeCastingStrategy` can be set to `"tryCasting"` if you want the decoder to
  try and perform some common casts before failing when it runs into an
  unexpected type. For example, when decoding a number, if the decoder runs into
  a string it can try to turn into a number before failing.  
  The default is `"expectExactTypes"`, so the decoding fails as soon as an
  unexpected type is met
- `errorReportingStrategy` can be set to `"allErrors"` if you want the decoder
  to try and gather as many errors as possible before failing.  
  The default is `"stopAtFirstError"`, so the decoding immediately fails as soon
  as the first error is encountered

```ts showLineNumbers
const array = nonNegativeNumber.array()

array.decode([-1, 0, -2], { errorReportingStrategy: "allErrors" })
// -> error([
//   { assertion: ">= 0", got: -1, path: "$[0]" },
//   { assertion: ">= 0", got: -2, path: "$[2]" },
// ])
```
