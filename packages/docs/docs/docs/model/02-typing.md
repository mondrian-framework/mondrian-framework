# Typing

In the [previous chapter](./01-definition.md) you learned about the Mondrian
types and how they can be defined. Consider this example type we've shown before:

```ts showLineNumbers
const user = types.object({
  id: types.integer(),
  username: types.string(),
})
```

It acts as a _description_ of the structure of users: every value with a type
that conforms to `user` should have an integer `id` field and a string `username`
field.

However, this description wouldn't be too useful if there wasn't a way to actually
create values conforming to the types we define.
That's why the Mondrian framework also exposes many utility methods and types to
bridge the gap between Typescript's and Mondrian's type systems.

## Type inference

You may have noticed that all the Mondrian types are closely related to Typescript
ones: Mondrian primitives can easily be mapped to Typescript's
(`types.number()` is `number`, `types.string()` is `string`, and so on); the
same applies for complex types like objects, arrays and optional values.

Thanks to this resemblance, every Mondrian type can be turned into a corresponding
Typescript type thanks to the `types.Infer` type:

```ts showLineNumbers
const model = types.number()
type Model = types.Infer<typeof model> // -> number

const value: Model = 10
```

### Inference of primitives

All Mondrian primitive types are turned into the corresponding Typescript's
primitive type:

| Mondrian type                | Inferred Typescript type        |
| ---------------------------- | ------------------------------- |
| `types.number()`             | `number`                        |
| `types.string()`             | `string`                        |
| `types.boolean()`            | `boolean`                       |
| `types.enum(["foo", "bar"])` | <code>"foo" &#124; "bar"</code> |
| `types.literal(1)`           | `1`                             |
| `types.literal("foo")`       | `"foo"`                         |

### Inference of wrapper types

Inference for wrapper types works as one may expect: optional and nullable types
are turned into an untagged union with `undefined` and `null` respectively.
Arrays are inferred as Typescript's arrays.

| Mondrian Type        | Inferred Typescript type                                  |
| -------------------- | --------------------------------------------------------- |
| `types.optional(t)`  | <code>undefined &#124; types.Infer&lt;typeof t&gt;</code> |
| `types.nullable(t)`  | <code>null &#124; types.Infer&lt;typeof t&gt;</code>      |
| `types.array(t)`     | `types.Infer<typeof t>[]`                                 |
| `types.reference(t)` | `types.Infer<typeof t>`                                   |

Here are some examples of inference for wrapper types:

```ts showLineNumbers
type StringArray = types.Infer<typeof stringArray> // string[]
const stringArray = types.string().array()

const value: StringArray = ["Hello", " ", "Mondrian", "!"]
```

```ts showLineNumbers
type OptionalNumber = types.Infer<typeof optionalNumber> // number | undefined
const optionalNumber = types.number().optional()

const missing: OptionalNumber = undefined
const value: OptionalNumber = 10
```

### Inference of objects

Mondrian objects can be turned into Typescript's object types. Let's work through an
example and see how it works:

```ts showLineNumbers
const book = types.object({
  title: types.string(),
  publicationYear: types.number(),
  author: types.object({
    firstName: types.string(),
    lastName: types.string(),
  }).optional(),
})

type Book = types.Infer<typeof book>
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
the fields of the object's model: `title` is _described_ by a `types.string()`
so the resulting inferred type for that field is `string`, `author` is itself a
`types.object({...})` so its type is the inferred type for that object: a record
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
const mutableBook = book.mutable()
type MutableBook = types.Infer<typeof mutableBook>
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
const response = types.union({
  success: types.string(),
  error: types.object({
    code: types.number(),
    message: types.string(),
  })
})

type Response = types.Infer<typeof response>
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
verify this: `types.isType` and `types.assertType`.

### `types.isType`

This function exposed by the `types` module takes two inputs: a mondrian type
definition and an unknown value. It returns true if the value actually
conforms to the mondrian definition:

```ts
const error = types.object({ code: types.number(), message: types.string() })

types.isType(error, { code: "not-a-code" })
// -> false
// It is missing the `message` field and `code` is not a number

types.isType(error, { code: 418, message: "I'm a teapot" })
// -> true
```

If you check `isType`'s return type you may notice that it is doing something a
bit smarter:

```ts
export function isType<T extends types.Type>(type: T, value: unknown, ...): value is types.Infer<T>
```

It is actually using a
[type predicate](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates)
to allow you to use the value given as input as an actual instance of that type
in case it returns true. This plays nicely used with `if` statements and type
narrowing:

```ts
const error = types.object({ code: types.number(), message: types.string() })

const value: unknown  = { code: 418, message: "I'm a teapot" }

if (types.isType(error, value)) {
  // Here value is of type `types.Infer<typeof error>` so we can access its fields
  console.log("Error code:", value.code)
  console.log("Error message:", value.message)
} else {
  ...
}
```

### `types.assertType`

This function works exactly like `isType` but instead of returning a boolean
value, it throws an exception if the given value does not conform to the given
type:

```ts
types.assertType(error, { code: "not-a-number" })
// -> throws an exception

types.assertType(error, { code: 418, message: "I'm a teapot" })
// does not throw
```

Once again, this plays nicely with Typescript's type narrowing: if the assertion
does not fail, from that point on you can treat the value as if it were of the
expected type:

```ts
const value: unknown = { code: 418, message: "I'm a teapot" }
types.assertType(error, value)
// Here value is of type `types.Infer<typeof error>` so we can access its fields
console.log("Error code:", value.code)
console.log("Error message:", value.message)
```
