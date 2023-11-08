# Definition

The `@mondrian-framework/model` package contains a wide range of useful
functions for defining a data model schema, from primitive types to complex
objects, arrays, and unions. It does so by providing a series of builders that
can help make development straightforward and the schema as readable as possible.

Everything you may need to define a new schema is defined inside the `types`
namespace of the `@mondrian-framework/model` package, so to get things started
you should import it:

```ts showLineNumbers
import { model } from '@mondrian-framework/model'
```

## Primitives

Mondrian Framework supports the definition of a small, simple but powerful range
of primitive types.

```ts showLineNumbers
model.boolean()
model.string()
model.number()
model.integer()
model.datetime()
model.timestamp()
```

Each of these can accept different parameters that can refine their semantics with
some options, like common validation rules.

```ts showLineNumbers
model.string({ minLength: 1, maxLength: 256, regex: /^[1-9]\d{0,2}$/g })
model.number({ minimum: 0, exclusiveMaximum: 10000 })
model.integer({ minimum: 0, maximum: 10 })
```

Furthermore, each type constructor allows for the possibility of setting a
description parameter where useful text can be inserted for generating automatic
documentation of the model.

```ts showLineNumbers
const emailAddress = model.string({
  description: "A string representing a valid email address",
  regex: ^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,4}$,
})

const positiveNumber = model.number({
  description: "A positive number"
  minimum: 0,
})
```

### Enums

Enums allow to define a set of named constants. Using enums can make it easier
to document intent, or create a set of distinct cases. Mondrian provides only
string-based enums:

```ts showLineNumbers
const userKind = model.enumeration(['customer', 'admin'])
```

### Literals

Literals represent _specific_ strings or numbers in type positions.
They are a common construct in the TypeScript language and they are supported by
the Mondrian Framework as well:

```ts showLineNumbers
const zero = model.literal(0)
const greeting = model.literal('Hello, World!')
```

### Additional Types

Besides the primitive types you can find in `@mondrian-framework/model`, there's
also a wide range of utility types that are already implemented and ready to use.

To use those definitions you can import the package like this:

```ts showLineNumbers
import types from '@mondrian-framework/model'
```

There are definitions related to date and time:

```ts showLineNumbers
model.date() // date string without time, ex: 2023-01-24
model.time() // time only string RFC 3339, ex: 12:05:55Z
model.timezone() // IANA Time Zone, ex: Europe/Rome
```

To locations:

```ts showLineNumbers
model.countryCode() // ISO 3166-1 alpha-2, ex: IT
model.latitude()
model.longitude()
model.locale() // ISO 639-1, ex: it
model.currency() // ISO 4217, ex: EUR
```

And many more:

```ts showLineNumbers
model.email()
model.phoneNumber() // E.164 ex: +17895551234
model.mac() // IEEE 802 48-bit
model.ip() // IPv4 or IPv6 address
model.port() // TCP port
model.version() // semantic version, ex: 1.1.2
model.jwt() // JSON Web Token
model.url() // RFC 3986, ex: https://www.google.com
model.uuid() // Universal Unique Identifier
model.isbn() // ISBN-10 or ISBN-13
model.rgb() // CSS RGB, ex: rgb(255, 220, 200)
model.rgba() // CSS RGBA, ex: rgba(255, 220, 200, 0.5)
```

## Wrapper types

Only primitive types wouldn't get us far in defining complex business domains.
That's why Mondrian also supports the definition of wrapper types like arrays,
optional, and nullable values that can wrap and enrich the definition of any
other Mondrian type.

### Optional

The `optional()` type builder can be used to turn any type definition into the
corresponding optional type.
This means that the given type can be also `undefined`, or not specified if
assigned to a field of an [object](#objects).

Optional types can be defined by wrapping other Mondrian types:

```ts showLineNumbers
// These definitions are equivalent
const optionalString1 = model.optional(model.string())
const optionalString2 = model.string().optional()
// same as string | undefined
```

Like with other Mondrian types, optionals can also accept additional options:

```ts showLineNumbers
const optional = model.number().optional({
  description: 'An optional number!',
})
```

### Nullable

Similarly to optional types, you can make any type nullable with the `nullable()`
decorator.
This means that the given type can be also `null`:

```ts showLineNumbers
const nullableString1 = model.nullable(model.string())
const nullableString2 = model.string().nullable()
// same as string | null
```

### Arrays

Just like optionals and nullables, array types can be defined by wrapping another
Mondrian type.
The resulting definition describes an array of values of the wrapped type:

```ts showLineNumbers
const arrayOfStrings1 = model.array(model.string())
const arrayOfStrings2 = model.string().array()
// same as string[]
```

Array definitions, like many other Mondrian types, support optional parameters:

```ts showLineNumbers
const nonEmptyArray1 = model.array(model.string(), { minItems: 1 })
const nonEmptyArray2 = model.string().array({ minItems: 1 })
```

Combining the `array` decorator with others like `optional` and `nullable`
assumes different meanings depending on the order in which they are applied.
Note, for example, the following two cases:

```ts showLineNumbers
const nullableArrayOfStrings = model.string().array().nullable()
// same as string[] | null

const arrayOfNullableStrings = model.string().nullable().array()
// same as (string | null)[]
```

## Composite types

Another key piece fundamental in order to get an expressive model is the ability
to define sum and product model.
Mondrian allows such definitions with the ability to define unions and objects.

### Objects

Objects are structured types with a set of fields. By default the object's
fields are required and immutable:

```ts showLineNumbers
const myObject = model.object({
  field1: model.number(),
  field2: model.string(),
})
// same as { readonly field1: number, readonly field2: string }
```

#### Object mutability

Being immutable is a sensitive default that should be good for almost all cases;
however, sometimes it could be necessary to define an object with mutable fields.
In order to do so, one can use the `.mutable()` method:

```ts showLineNumbers
const myMutableObject = myObject.mutable()
// same as { field1: number, field2: string }
```

Likewise, a mutable object definition can be turned back into an immutable one
with the `.immutable()` method:

```ts showLineNumbers
const backToImmutable = myMutableObject.immutable()
// same as { readonly field1: number, readonly field2: string }
```

#### Possibly missing fields

Fields are considered required by default. To define a possibly missing
field one can use an optional Mondrian type:

```ts showLineNumbers
const myObject = model.object({
  required: model.number(),
  optional: model.string().optional(),
})
// same as { readonly required: number, readonly optional?: string }
```

#### Complex object definitions

All the examples shown so far only use primitive and wrapper types as object
fields. However, nothing is stopping you from using _any kind_ of Mondrian
type, no matter how complex it is!

An object could have primitive types, other objects, unions, or even
[custom types](#custom-types) as their fields. Let's consider a more complex
example:

```ts showLineNumbers
const address = model.object({
  country: model.string(),
  city: model.string(),
  street: model.string(),
})

const user = model.object({
  id: model.number(),
  name: model.string(),
  // highlight-start
  mainAddress: address,
  secondaryAddresses: address.array(),
  // highlight-end
})
```

### Unions

Unions are a way to define types that can hold values from a fixed set of types
(usually referred to as variants).

In Mondrian we can define a union by specifying all of its possible variants:

```ts showLineNumbers
const myUnion = model.union({
  firstVariant: model.string(),
  secondVariant: model.number(),
})
// same as { readonly variant1: string } | { readonly variant2: number }
```

As you can see, there is a difference in how TypeScript natively handles
variants: Mondrian variants are _tagged_, meaning that each variant of a union
type must have a unique name to tell it apart from the others.

Just like object fields, union variants can be of any Mondrian type:

```ts showLineNumbers
// This type models the fact that a user can either be
// logged in, or a guest
const user = model.union({
  loggedIn: model.object({ name: model.string() }),
  guest: model.object({}),
})
```

#### A thorough example

With these building blocks, we have a powerful toolbox to expressively describe
complex domains.

Let's work through a more complex example and see how this would work out.
In this example we're modeling (a simplified version of) user login:

- we receive a password and username as input
- we send back a response that can either be successful or contain an error message:
  - if the user can be logged in the response is successful and contains the user's information
  - if the user cannot be logged in the response will contain an error message

The type definitions needed for this example would be the following:

```ts showLineNumbers
// The type of users, arguably it could be more complex but it's ok as an example
type User = model.Infer<typeof User>
const User = model.object({
  id: model.integer(),
  username: model.string(),
})

// The input we receive when a user wants to login
type AuthenticationData = model.Infer<typeof AuthenticationData>
const AuthenticationData = model.object({
  username: model.string(),
  password: model.string(),
})

// The type of the response: it can either be a `success` or `failure`
type LoginResponse = model.Infer<typeof LoginResponse>
const LoginResponse = model.union({
  success: user,
  failure: model.object({
    reason: model.string(),
  }),
})
```

Given these type definitions we can get an idea of how the login process could
work out:

```ts showLineNumbers
async function loginUser(auth: AuthenticationData) {
  const user = await fetchUser(auth.username, auth.password)
  const response = user ? { success: user } : { failure: { reason: 'wrong username or password' } }

  await sendResponse(response)
}
```

Types definitions can help us define clear and expressive models that are
faithful to the modeled domain.

## Custom types

Sometimes the types offered by the Mondrian framework may not be enough for
your needs. That's why you can also define custom types that implement
completely arbitrary logic. The mentioned [advanced types](#additional-types)
are built exactly in this way.

A custom type can be defined using the `custom` function:

```ts showLineNumbers
const MyCustomType = model.custom<"name", {}, number>(...)
```

As you may have noticed, the `custom` function has three generic types:

- the literal string with the name of the custom type
- the type of additional options that may be needed by the custom type,
  besides the basic options shared by all the Mondrian types
- the inferred type for the custom type ([here's](./02-typing.md)
  a more thorough explanation of Mondrian's type inference)

Then, the arguments you need to pass to the custom builder are:

- the name of the custom type
- a decoder that can turn unknown values into that custom type's inferred type
- an encoder that can turn custom types into JSON values
- a validator that may perform additional validation logic to ensure that values are correct
- additional options for that custom type

Below is an example implementation of the `port` type that represents a TCP port.
It could also be defined as a simple integer, however, defining it as a custom
type can prove to be more expressive and it would also allow you to define custom
arbitrary decoding, encoding, and validation logic:

```ts showLineNumbers
import { validation, decoding, model } from '@mondrian-framework/model'

const MIN_PORT_NUMBER = 0
const MAX_PORT_NUMBER = 65535

export function port(options: model.BaseOptions): model.CustomType<'port', {}, number> {
  return model.custom<'port', {}, number>('port', encodePort, decodePort, validatePort, options)
}

// Since a port is a number it is already a JSONType and encoding is a no-op
function encodePort(port: number): JSONType {
  return port
}

// A value is of type port if it is a number between MAX_PORT_NUMBER and MIN_PORT_NUMBER
function decodePort(value: unknown): decoding.Result<number> {
  if (typeof value !== 'number') {
    return decoding.fail('a port number', value)
  } else if (value < MIN_PORT_NUMBER || value > MAX_PORT_NUMBER) {
    return decoding.fail('a port number between 0 and 65535', value)
  } else {
    return decoding.succeed(value)
  }
}

// There's no additional validation to perform, so always return a succeeding result
function validatePort(port: number): validation.Result {
  return validation.succeed()
}
```

## Reference

## Select

## Merge

## Recursion
