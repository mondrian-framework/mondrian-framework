# Custom types

Mondrian type system is already flexible enough to express a wide variety of
[useful types](./01-definition.md). However, sometimes you might find yourself
needing even more: maybe because you want to change the default inference rules
or the way a value gets encoded and decoded.

In this case, you'll need to reach out for custom types: a powerful way to
extend Mondrian's capabilities.

## How to define a custom type

We've already briefly covered custom types in the
[definition chapter](./01-definition.md), now it's time to have an in-depth
look at how those can be defined.

### Custom types are named

Every custom type has a name that can be useful when referring to it, this is
the first argument of the `types.custom` builder function:

```ts showLineNumbers
const myType = types.custom<"typeName", ...>("typeName", ...)
```

As you may have noticed, the literal string for the name must also be the first
_type argument_ of the `types.custom` function.

You can choose whatever name you feel is appropriate for your needs, the
Mondrian framework defines some custom types like `"dateTime"`, `"timezone"`,
`"RGB"`, and so on.

### Custom types can have additional options

Every custom type can also accept additional options, besides the default ones
shared by all Mondrian types. This is kept track of on the type level thanks to
an additional argument:

```ts showLineNumbers
const 
```

### Custom types can be inferred as any type

