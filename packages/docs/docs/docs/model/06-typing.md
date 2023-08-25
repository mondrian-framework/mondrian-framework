# Typing

In the [previous chapter](./01-definition.md) you learned about the Mondrian types and how they can be defined. Consider this example type we've shown before:

```ts
const user = types.object({
  id: types.integer(),
  username: types.string(),
})
```

It acts as a _description_ of the structure of users: every value with a type that conforms to `user` should have an integer `id` field and a string `username` field.

However, this description wouldn't be too useful if there wasn't a way to actually create values conforming to the types we define.
That's why the Mondrian framework also exposes many utility methods and types to brdige the gap between Typescript's and Mondrian's type systems.

## Infer

You may have noticed that all the Mondrian types are closely related to Typescript ones: Mondrian primitives can easily be mapped to Typescript's (`types.number()` is `number`, `types.string()` is `string`, and so on); the same applies for complex types like objects, arrays and optional values.

Thanks to this resemblance, every Mondrian type can be turned into a corresponding Typescript type thanks to the `types.Infer` type:

```ts
const model = types.number()
type Model = types.Infer<typeof model> // -> number

const value: Model = 10
```

### Inference of primitives

All Mondrian primitive types are turned into the corresponding Typescript's primitive type:

| Mondrian type                | Inferred Typescript type        |
| ---------------------------- | ------------------------------- |
| `types.number()`             | `number`                        |
| `types.string()`             | `string`                        |
| `types.boolean()`            | `boolean`                       |
| `types.enum(["foo", "bar"])` | <code>"foo" &#124; "bar"</code> |
| `types.literal(1)`           | `1`                             |
| `types.literal("foo")`       | `"foo"`                         |

### Inference of wrapper types

| Mondrian Type     | Inferred Typescript type                                  |
| ----------------- | --------------------------------------------------------- |
| types.optional(t) | <code>undefined &#124; types.Infer&lt;typeof t&gt;</code> |
| types.nullable(t) | <code>null &#124; types.Infer&lt;typeof t&gt;</code>      |
| types.array(t)    | `types.Infer<typeof t>[]`                                 |

### Inference of objects

### Inference of unions

### Why bother with Mondrian types?

## Project

## isType

## assertType
