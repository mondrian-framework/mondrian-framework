# Typing

In the [definition chapter](./01-definition.md), you learned about Mondrian
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

However, this description wouldn't be very useful if there wasn't a way to actually
create values conforming to the types we define. That's why the Mondrian framework
also exposes many utility methods and types to bridge the gap between TypeScript's
and Mondrian's type systems.

## Type inference

You may have noticed that all Mondrian types are closely related to TypeScript
ones. `model.number()` is related to `number`, `model.string()` to `string`, and so on.
The same applies to complex types like objects, arrays, and optional values.

Thanks to this resemblance, every Mondrian type can be turned into a corresponding
TypeScript type using the `model.Infer<T>` utility type:

```ts showLineNumbers
const Model = model.number()
type Model = model.Infer<typeof Model> // -> number

const value: Model = 10
```

### Inference of primitives

All Mondrian primitive types are turned into the corresponding TypeScript
primitive type:

| Mondrian type                       | Inferred TypeScript type        |
| ----------------------------------- | ------------------------------- |
| `model.number()`                    | `number`                        |
| `model.string()`                    | `string`                        |
| `model.boolean()`                   | `boolean`                       |
| `model.enumeration(["foo", "bar"])` | <code>"foo" &#124; "bar"</code> |
| `model.literal(1)`                  | `1`                             |
| `model.literal("foo")`              | `"foo"`                         |
| `model.null()`                      | `null`                          |
| `model.undefined()`                 | `undefined`                     |

### Inference of wrapper types

Inference for wrapper types works as one might expect: optional and nullable types
are turned into untagged unions with `undefined` and `null` respectively.
Arrays are inferred as TypeScript arrays (`readonly` by default).

| Mondrian Type       | Inferred TypeScript type                                  |
| ------------------- | --------------------------------------------------------- |
| `model.optional(t)` | <code>undefined &#124; model.Infer&lt;typeof t&gt;</code> |
| `model.nullable(t)` | <code>null &#124; model.Infer&lt;typeof t&gt;</code>      |
| `model.array(t)`    | `model.Infer<typeof t>[]`                                 |

Here are some examples of inference for wrapper types:

```ts showLineNumbers
type StringArray = model.Infer<typeof StringArray> // string[]
const StringArray = model.string().array()

const value: StringArray = ['Hello', ' ', 'Mondrian', '!']
```

```ts showLineNumbers
type OptionalNumber = model.Infer<typeof OptionalNumber> // number | undefined
const OptionalNumber = model.number().optional()

const missing: OptionalNumber = undefined
const value: OptionalNumber = 10
```

### Inference of objects

Mondrian objects can be turned into TypeScript object types. Let's work through an
example and see how it works:

```ts showLineNumbers
const Book = model.object({
  title: model.string(),
  publicationYear: model.number(),
  author: model
    .object({
      firstName: model.string(),
      lastName: model.string(),
    })
    .optional(),
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

As you can see, the inferred type is obtained by inferring the type of each
field in the object's model: `title` is _described_ by `model.string()`, 
so the resulting inferred type for that field is `string`; `author` is itself a
`model.object({...})` optionally wrapped, so its type is the inferred type for that object unioned with `undefined`: a record
with two `string`-typed fields `firstName` and `lastName`, or `undefined`.

Fields with an optional type are correctly inferred as optional properties in the TypeScript type, so `author`
is inferred as `author?: { ... } | undefined`.

There's one last important thing to point out: every object is inferred with
`readonly` fields by default. This may look a bit
odd at first but is actually a good default, and Mondrian encourages you
to embrace data immutability. If you are interested in the topic and want to go
deeper into the reasons why this is the preferred approach, you can check out
[_Data-Oriented Programming_](https://www.manning.com/books/data-oriented-programming)
by Yehonathan Sharvit, where he makes a great case for building systems centered around
immutability.

In the rare case one needs a mutable data structure, they can turn the
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

Notice how the inner object (`author`) is still inferred with `readonly` fields! You'd have to mark that object type as
mutable as well to change its inferred type.

### Inference of unions

Exactly like TypeScript unions, a Mondrian union is inferred as a union of the inferred types of its variants.

```ts showLineNumbers
const Response = model.union({
  success: model.object({
    success: model.literal(true),
    value: model.string(),
  }),
  error: model.object({
    success: model.literal(false),
    code: model.number(),
  }),
})

type Response = model.Infer<typeof Response>
// ->
//   { readonly success: true; readonly value: string }
// | { readonly success: false; readonly code: number }
```

### Why bother with Mondrian types?

After working through these examples, you may wonder: why do we need to jump
through all these extra hoops to get a TypeScript type? In the end, each
Mondrian model gets inferred as a TypeScript type, so why not write that
directly?

First of all, TypeScript types exist only at compile time and completely disappear
at runtime. This means that they cannot be used, for example, to validate a piece
of data or to provide runtime documentation.

Moreover, having a schema definition allows you to navigate it programmatically to automatically generate any kind of
present or future artifact directly inferred from your domain model (e.g., API specifications, database schemas, validation functions, etc.).

## Utility functions

When working with unknown data, you may not be sure that it actually conforms
to a specific type. Hand-writing validation code can be tedious and error-prone. That's
why Mondrian provides two utility functions that allow you to
verify this: `model.isType` and `model.assertType`.

### `model.isType`

This function, exposed by the `model` module, takes two inputs: a Mondrian type
definition and an unknown value. It returns `true` if the value actually
conforms to the Mondrian definition, and `false` otherwise:

```ts
const Error = model.object({ code: model.number(), message: model.string() })

model.isType(Error, { code: 'not-a-code' })
// -> false
// It is missing the `message` field and `code` is not a number

model.isType(Error, { code: 418, message: "I'm a teapot" })
// -> true
```

If you check `isType`'s return type, you may notice that it's doing something a
bit smarter:

```ts
export function isType<T extends model.Type>(type: T, value: unknown, ...): value is model.Infer<T>
```

It's actually using a
[type predicate](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates).
This allows you to use the value given as input as an actual instance of the inferred type
within code blocks where `isType` returns `true`. This plays nicely with `if` statements and type
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

This function works similarly to `isType`, but instead of returning a boolean
value, it throws a detailed exception if the given value does not conform to the given
type:

```ts
model.assertType(Error, { code: 'not-a-number' })
// -> throws an exception

model.assertType(Error, { code: 418, message: "I'm a teapot" })
// does not throw
```

Once again, this plays nicely with TypeScript's type narrowing: if the assertion
does not throw an exception, from that point onward in the code flow, you can treat the value as if it were of the
expected inferred type:

```ts
const value: unknown = { code: 418, message: "I'm a teapot" }
model.assertType(Error, value)
// Here value is of type `model.Infer<typeof Error>` so we can access its fields
console.log('Error code:', value.code)
console.log('Error message:', value.message)
```
