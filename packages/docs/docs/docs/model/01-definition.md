# Definition

The `@mondrian-framework/model` package contains a wide range of useful functions for defining a data model schema, from the simplest type `string` to complex objects, arrays, and unions. The syntax used has been designed to make development straightforward and the schema as readable as possible.

## Primitives
Mondrian Framework supports the definition of a really small and simple range of primitive types, which are basically the ones supported by the JSON specification.

```ts
import m from '@mondrian-framework/model'

m.boolean()
m.string()
m.number()
m.integer()
m.datetime()
m.timestamp()
m.null()
m.void()

```
Each of these can accept different options that can refine their semantics with some options, like common validation rules.

```ts
m.string({ minLength: 5, maxLength: 256, regex: /^[1-9]\d{0,2}$/g })
m.number({ minimum: 0, maximum: 10000, multiplierOf: 10 })
```

Furthermore, each function allows for the possibility of populating a description parameter where useful text can be inserted for generating automatic documentation of the model.

```ts
const EmailAddress = m.string({ 
  regex: ^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,4}$, 
  description: "A string representing a valid email address" 
})

const PositiveNumber = m.number({ 
  minimum: 0, 
  description: "A positive number" 
})
```

## Advanced Types

## Enumerators

## Literals

## Objects

## Arrays

## Unions

## Optional

## Nullable

## Default

## Reference

## Select

## Merge

## Recursion 