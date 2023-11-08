# Typing

In the [previous chapter](./01-definition.md) you learned about the Mondrian
types and how they can be defined. Consider this example type we've shown before:

```ts showLineNumbers
const User = model.object({
  id: model.integer(),
  username: model.string(),
})
```

It acts as a _description_ of the structure of users: every value with a type
that conforms to `User` should have an integer `id` field and a string `username`
field.

However, this description wouldn't be too useful if there wasn't a way to actually
create values conforming to the types we define.
That's why the Mondrian framework also exposes many utility methods and types to
bridge the gap between Typescript's and Mondrian's type systems.

## Type inference

You may have noticed that all the Mondrian types are closely related to Typescript
ones: Mondrian primitives can easily be mapped to Typescript's
(`model.number()` is `number`, `model.string()` is `string`, and so on); the
same applies for complex types like objects, arrays and optional values.

Thanks to this resemblance, every Mondrian type can be turned into a corresponding
Typescript type thanks to the `model.Infer` type:

```ts showLineNumbers
const Model = model.number()
type Model = model.Infer<typeof Model> // -> number

const value: Model = 10
```

### Inference of primitives

All Mondrian primitive types are turned into the corresponding Typescript's
primitive type:

| Mondrian type                | Inferred Typescript type        |
| ---------------------------- | ------------------------------- |
| `model.number()`             | `number`                        |
| `model.string()`             | `string`                        |
| `model.boolean()`            | `boolean`                       |
| `model.enum(["foo", "bar"])` | <code>"foo" &#124; "bar"</code> |
| `model.literal(1)`           | `1`                             |
| `model.literal("foo")`       | `"foo"`                         |

### Inference of wrapper types

Inference for wrapper types works as one may expect: optional and nullable types
are turned into an untagged union with `undefined` and `null` respectively.
Arrays are inferred as Typescript's arrays.

| Mondrian Type        | Inferred Typescript type                                  |
| -------------------- | --------------------------------------------------------- |
| `model.optional(t)`  | <code>undefined &#124; model.Infer&lt;typeof t&gt;</code> |
| `model.nullable(t)`  | <code>null &#124; model.Infer&lt;typeof t&gt;</code>      |
| `model.array(t)`     | `model.Infer<typeof t>[]`                                 |
| `model.reference(t)` | `model.Infer<typeof t>`                                   |

Here are some examples of inference for wrapper types:

```ts showLineNumbers
type StringArray = model.Infer<typeof StringArray> // string[]
const StringArray = model.string().array()

const value: StringArray = ["Hello", " ", "Mondrian", "!"]
```

```ts showLineNumbers
type OptionalNumber = model.Infer<typeof OptionalNumber> // number | undefined
const OptionalNumber = model.number().optional()

const missing: OptionalNumber = undefined
const value: OptionalNumber = 10
```

### Inference of objects

Mondrian objects can be turned into Typescript's object model. Let's work through an
example and see how it works:

```ts showLineNumbers
const Book = model.object({
  title: model.string(),
  publicationYear: model.number(),
  author: model.object({
    firstName: model.string(),
    lastName: model.string(),
  }).optional(),
})

type Book = model.Infer<typeof Book>
// -> {
//   readonly title: string,
//   readonly publicationYear: number,
//   readonly author?: {
//     readonly firstName: string,
//     readonly lastName: string,
//   } | undefined
// }
```

As you can see the inferred type is obtained by inferring the type of each of
the fields of the object's model: `title` is _described_ by a `model.string()`
so the resulting inferred type for that field is `string`, `author` is itself a
`model.object({...})` so its type is the inferred type for that object: a record
with two `string`-typed fields `firstName` and `lastName`.

Fields with an optional type are correctly inferred to be optional, so `author`
is inferred as `author?: { ... } | undefined`.

There's one last important thing to point out: every object is inferred to be
immutable by default, each one of its fields is `readonly`. This may look a bit
odd at first but is actually a really good default and Mondrian encourages you
to embrace data immutability. If you are interested in the topic and want to go
deeper into the reason why this is the preferred approach, you can check out
[_Data-Oriented Programming_](https://www.manning.com/books/data-oriented-programming)
where Yehonathan Sharvit makes a great case for building systems centered around
immutability.

In the rare case one would need a mutable data structure they can turn the
object type definition into a mutable one like this:

```ts showLineNumbers
const MutableBook = book.mutable()
type MutableBook = model.Infer<typeof MutableBook>
// -> {
//   title: string,
//   publicationYear: number,
//   author?: {
//     readonly firstName: string,
//     readonly lastName: string,
//   }
// }
```

Notice how the inner object is still immutable! You'd have to mark that as
mutable as well to change its inferred type.

### Inference of unions

Mondrian unions behave a bit differently from Typescript's ones.
Typescript's unions are what is usually called _untagged unions_, meaning we can
create unions from any type. Each of the types composing a union is called a
_variant_, for example `string | number | undefined` has 3 variants: `string`,
`number` and `undefined`.

Mondrian takes a different approach and only supports the definition of
_tagged unions_. This means that each one of the variants of a union must have
a name to uniquely identify it. If we were to rewrite the preious untagged union
into a tagged one we could do it like this:

```ts showLineNumbers
type Untagged = string | number | undefined
type Tagged = 
  | { stringVariant: string }
  | { numberVariant: number }
  | { undefinedVariant: undefined }
```

As you can see now each variant is an object with a single field whose name
can be used as the name for the variant: the first one is called `stringVariant`,
the second one `numberVariant` and the final one `undefinedVariant` (but we could
use any name that makes sense for the domain we're modelling).

After this introduction Mondrian's type inference for unions shouldn't be too
surprising:

```ts showLineNumbers
const Response = model.union({
  success: model.string(),
  error: model.object({
    code: model.number(),
    message: model.string(),
  })
})

type Response = model.Infer<typeof Response>
// ->
//   { readonly success : string }
// | {
//     readonly error: {
//       readonly code: number,
//       readonly message: string, 
//     }
//   }
```

Each of the specified variants (in the example, `success` and `error`) gets
turned into a single-field object: the field's name is the variant's name and
its value is the corresponding inferred type.

### Why bother with Mondrian types?

After working through these examples you may wonder why do we need to jump
through all these extra hoops to get a Typescript's type? In the end each of the
Mondrian models gets inferred as a Typescript's type so why not write that
directly?

The point is that, thanks to these definitions, Mondrian can automatically
generate a lot of boilerplate code for you: for example
[encoders](./03-encode.md) and [decoders](./04-decode.md).

## Utility functions

When working with unknown data you may not be sure that it actually conforms
to a type, hand writing validation code may be tedious and error prone. That's
why Mondrian already provides two utility functions that allow you to
verify this: `model.isType` and `model.assertType`.

### `model.isType`

This function exposed by the `types` module takes two inputs: a mondrian type
definition and an unknown value. It returns true if the value actually
conforms to the mondrian definition:

```ts
const Error = model.object({ code: model.number(), message: model.string() })

model.isType(Error, { code: "not-a-code" })
// -> false
// It is missing the `message` field and `code` is not a number

model.isType(Error, { code: 418, message: "I'm a teapot" })
// -> true
```

If you check `isType`'s return type you may notice that it is doing something a
bit smarter:

```ts
export function isType<T extends model.Type>(type: T, value: unknown, ...): value is model.Infer<T>
```

It is actually using a
[type predicate](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates)
to allow you to use the value given as input as an actual instance of that type
in case it returns true. This plays nicely used with `if` statements and type
narrowing:

```ts
const Error = model.object({ code: model.number(), message: model.string() })

const value: unknown  = { code: 418, message: "I'm a teapot" }

if (model.isType(Error, value)) {
  // Here value is of type `model.Infer<typeof Error>` so we can access its fields
  console.log("Error code:", value.code)
  console.log("Error message:", value.message)
} else {
  ...
}
```

### `model.assertType`

This function works exactly like `isType` but instead of returning a boolean
value, it throws an exception if the given value does not conform to the given
type:

```ts
model.assertType(Error, { code: "not-a-number" })
// -> throws an exception

model.assertType(Error, { code: 418, message: "I'm a teapot" })
// does not throw
```

Once again, this plays nicely with Typescript's type narrowing: if the assertion
does not fail, from that point on you can treat the value as if it were of the
expected type:

```ts
const value: unknown = { code: 418, message: "I'm a teapot" }
model.assertType(Error, value)
// Here value is of type `model.Infer<typeof Error>` so we can access its fields
console.log("Error code:", value.code)
console.log("Error message:", value.message)
```
