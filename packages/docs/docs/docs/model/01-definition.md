# Definition

The `@mondrian-framework/model` package contains a wide range of useful
functions for defining a domain model schema, from primitive types to complex
objects, arrays and unions. It does so by providing a series of builders that
can help make development straightforward and the schema as readable as possible.

Everything you may need to define a new schema is enclosed inside the `types`
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

## Additional Types

Besides the primitive types you can find in `@mondrian-framework/model`, there's
also a wide range of utility types that are already implemented and ready to use.

There are definitions related to date and time:

```ts showLineNumbers
model.datetime() // js Date
model.timestamp() // unix time in millis
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
model.json() // only JSON values
model.url() // RFC 3986, ex: https://www.google.com
model.uuid() // Universal Unique Identifier
model.isbn() // ISBN-10 or ISBN-13
model.rgb() // CSS RGB, ex: rgb(255, 220, 200)
model.rgba() // CSS RGBA, ex: rgba(255, 220, 200, 0.5)
model.unknown() // any value
model.record([type]) // Record<string, [type]>
```

## Enums

Enums allow to define a set of named constants. Using enums can make it easier
to document intent, or create a set of distinct cases. Mondrian provides only
string-based enums:

```ts showLineNumbers
const userKind = model.enumeration(['customer', 'admin'])
```

## Literals

Literals represent _specific_ strings, numbers or booleans in type positions.
They are a common construct in the TypeScript language and they are supported by
the Mondrian Framework as well:

```ts showLineNumbers
const zero = model.literal(0)
const greeting = model.literal('Hello, World!')
```

## Wrapper types

Only primitive types wouldn't get us far in defining complex business domains.
That's why Mondrian also supports the definition of wrapper types like arrays,
optional, and nullable values that can wrap and enrich the definition of any
other type.

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
// same as readonly string[]
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
// same as readonly string[] | null

const arrayOfNullableStrings = model.string().nullable().array()
// same as readonly (string | null)[]
```

#### Array mutability

Being immutable is a sensitive default that should be good for almost all cases;
however, sometimes it could be necessary to define a mutable array.
In order to do so, one can explicitly use the `.mutable()` method:

```ts showLineNumbers
const myMutableArray = model.number().array().mutable()
// same as number[]
```

Likewise, a mutable array definition can be turned back into an immutable one
with the `.immutable()` method:

```ts showLineNumbers
const backToImmutable = myMutableArray.immutable()
// same as readonly number[]
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
// same as { readonly required: number, readonly optional?: string | undefined }
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

### Entities

Entities are structured types with a set of fields, exactly as previously seen [objects](#objects). The main difference in their semantic: an entity represents a formal specification of a root domain concept, while an object represent a specific structured value without an identity.

Take as an example two different structured data as the followings: 

```ts showLineNumbers
const User = model.entity({
  id: model.string(),
  name: model.string(),
  surname: model.string(),
})

const RegistrationInput = model.object({
  name: model.string(),
  surname: model.string(),
})
```

The first represent a well difeined concept in the domain of an application, a user, which typically has its counterpart in the data model. The second, on the other hand, represents an utility, operational data structure that is generally built at runtime for convenience but does not refer to a domain concept.

In addition to being very important from a conceptual point of view, this difference finds its importance in all those parts of the framework that offer additional functionalities for processing domain entities. 

### Unions

Unions are a way to define types that can hold values from a fixed set of types
(usually referred to as variants).

In Mondrian we can define a union by specifying all of its possible variants:

```ts showLineNumbers
const myUnion = model.union({
  firstVariant: model.string(),
  secondVariant: model.number(),
})
// same as string | number
```

As you can see, the variants are tagged in the definition. That's because it's
very convenient for internal usage.

Just like object fields, union variants can be of any Mondrian type:

```ts showLineNumbers
const user = model.union({
  dog: model.object({ type: model.literal('dog') }),
  cat: model.object({ type: model.literal('cat') }),
})
// same as { type: 'dog' } | { type: 'cat' }
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
  const user: User | null = await fetchUser(auth.username, auth.password)
  const response: LoginResponse = user ? user : { reason: 'wrong username or password' }

  await sendResponse(response)
}
```

Types definitions can help us define clear and expressive models that are
faithful to the modeled domain.

## Lazy types

In order to model complex relations Mondrian offer an easy way to express recursive types.

```ts showLineNumbers
const User = () =>
  model.object({
    id: model.string(),
    name: model.string(),
    posts: model.array(Post),
  })
//same as { id: string, name: string, posts: { id: string, content: string, author: { ... } }[] }

const Post = () =>
  model.object({
    id: model.string(),
    content: model.string(),
    author: User,
  })
//same as { id: string, content: string, author: { id: string, name: string, posts: { ... }[] } }
```

A lazy type is any function that returns a lazy type or a type, so this is also valid:

```ts showLineNumbers
const SuperLazyString = () => () => () => model.string()
//same as string
```

A lazy type can have reference to itself:

```ts showLineNumbers
type User = model.Infer<typeof User>
const User = () =>
  model.object({
    id: model.string(),
    name: model.string(),
    bestFriend: model.optional(User),
  })
//same as type User = { id: string, name: string, bestFriend?: User }

type DeepArray = model.Infer<typeof DeepArray>
const DeepArray = () => model.array(model.union({ value: model.number(), array: DeepArray }))
//same as
//type DeepArray = (number | DeepArray)[]
```

Another aspect of lazy types is that the type name are inferred from the function name.

```ts showLineNumbers
const User = () =>
  model.object({
    id: model.string(),
    name: model.string(),
  })

// same of

const User = model
  .object({
    id: model.string(),
    name: model.string(),
  })
  .setName('User')
```


## Custom types

Mondrian type system is already flexible enough to express a wide variety of
useful types. However, sometimes you might find yourself needing even more: 
maybe because you want to change the default inference rules or the way a value 
gets encoded and decoded. In this case, you'll need to reach out for custom types: 
a powerful way to extend Mondrian's capabilities. 

As an example, the mentioned [additional types](#additional-types) are built exactly 
in this way.

A custom type can be defined using the `custom` function from the `@mondrian-framework/model` 
package:

```ts showLineNumbers
const MyCustomType = model.custom<"port", {}, number>(...)
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
- an arbitraty that generates values semantically valid for the given options
- additional options for that custom type

### Name

Every custom type has a name that can be useful when referring to it, this is
the first argument of the `model.custom` builder function:

```ts showLineNumbers
const port = model.custom<"port", ...>("port", ...)
```

As you may have noticed, the literal string for the name must also be the first
_type argument_ of the `model.custom` function.

You can choose whatever name you feel is appropriate for your needs, the
Mondrian framework defines some custom types like `"datetime"`, `"timezone"`,
`"RGB"`, and so on.

### Additional options

Every custom type can also accept additional options, besides the default ones
shared by all Mondrian model. This is kept track of on the type level thanks to
an additional argument:

```ts showLineNumbers
type PortOptions = { allowWellKnownPorts: boolean }

const Port = model.custom<"port", PortOptions, ...>("port", ...)
const nonWellKnownPort = Port.setOptions({ allowWellKnownPorts: false })
```

As we'll see later, custom options can be useful for tweaking the behavior of
the decoding and validation functions.

### Inferred type

When defining a custom type, you also have the freedom of choosing the type it
will get inferred as by Mondrian.
The inferred type is what a decoder should return, and the starting point for an
encoder:

```ts showLineNumbers
const Port = model.custom<"port", PortOptions, number>("port", ...)
const InferredType = model.Infer<typeof Port> // -> number

Port.encode(...) // encode will only accept a `number` input
Port.decode(...) // decode will return a `number` when successful
```

Here it makes sense for ports to correspond to simple `number`s, but you may
choose any type, no matter how complex. The only thing you have to pay attention
to is that you must be able to turn it into a JSON, and build it from a JSON.

### Encoding

When defining a new custom type, you have to provide a function that can be used
to encode any value of its inferred type into a JSON.

This encoding function _does not perform any kind of validation_, which is in
turn performed by a custom validator you're going to provide later. Let's keep
ourselves focused on encoding and have a look at the example of ports:

```ts showLineNumbers
function encodePort(port: number): JSONType {
    return port
}

const Port = model.custom<"port", PortOptions, number>("port", encodePort, ...)
```

Once again, the encoder function has to take as input a value of the inferred
type and transform it into a `JSONType`. In this case, a number is already a
valid JSON so there's no need to perform any kind of further transformation.

If the inferred type were more complex, say a `Date` object, you'd need to think
of a way to turn it into a JSON; you could, for example, turn the `Date` object
into a string (and later decode the string with a `Date.parse`):

```ts showLineNumbers
function encodeDate(date: Date): JSONType {
  return date.toJSON() // This turns a Date object into a serializable string
}
```

### Decoding

In order to build a custom type you also need to provide a custom decoding
function. You may think of decoding as the process that can turn an `unknown`
value into a value of the inferred type.

The decoding function will take as input not only a `decoding.Options` object,
but also the options of the optional type that may be used to change the
decoding behavior.

```ts showLineNumbers
function decodePort(
    value: unknown,
    _decodingOptions?: decoding.Options,
    _customOptions?: PortOptions & model.BaseOptions,
): decoding.Result<number> {
    // Here we can ignore both the decodingOptions and the customOptions
    // since we don't need those
    if (typeof value !== "number") {
        return decoding.fail("a number (for a port)", value)
    } else {
        return decoding.succeed(value)
    }
}

const Port = model.custom<"port", PortOptions, number>("port", encodePort, decodePort, ...)
```

As you may have noticed, the decoding function has to return a
`decoding.Result` since the process may fail. The `decoding` module has two
useful functions you can use for this:

- `decoding.succeed` is returned to signal a success, it takes as input the
  correctly decoded value
- `decoding.fail` is returned to signal a failure, it takes as first argument a
  string describing the expected value, and as second argument the actual value
  it run into

As you can see, a decoder function _should not be concerned with the validation_
_logic_: its only purpose is to return a value of the given inferred type, any
kind of further validation _must be performed_ by the validator function.

For example, here we didn't check that the number is actually in the range
0-65535 because that will be done by the validator.

### Validation

It's now time to finally get to the validation part. A validation function is
the last bit of code we need to provide the `model.custom` builder to get a new
Mondrian type.

The validator should take as input a decoded value (of the specified inferred
type) and return a validation result: either a success or an error describing
what went wrong.

```ts showLineNumbers
function validatePort(
    port: number,
    _validationOptions?: validation.Options,
    customOptions?: PortOptions & model.BaseOptions,
): validation.Result {
    const wellKnownPortsAllowed = customOptions?.allowWellKnownPorts ?? true
    if (port < 0 || port > 65535) {
        return validation.fail("not a port number", port)
    } else if (!wellKnownPortsAllowed && port <= 1023) {
        // Here the customOptions can change how validation works out!
        return validation.fail("well known ports are not allowed", port)
    } else {
        return validation.succeed()
    }
}

const Port = model.custom<"port", PortOptions, number>("port", encodePort, decodePort, validatePort, ...)
```

Similarly to the decoding function, a validation function needs to return a
`validation.Result` since the process may fail. In order to do so, the
`validation` module provides two useful functions:

- `validation.succeed`, which takes no arguments and is returned when the
  validation is successful
- `validation.fail` is returned to signal a failure, it takes as its first
  argument a string describing the assertion that failed, and as its second
  argument the actual value that failed the assertion

This function will be used under the hood in pair with the provided
encoder/decoder to implement the `encode` and `decode` methods of the new type:

```ts showLineNumbers
type Port = model.Infer<typeof Port>
const Port = model.custom<"port", PortOptions, number>("port", encodePort, decodePort, validatePort, ...)

Port.decode(1024) // -> ok(1024)
Port.decode("foo") // -> error([{ expected: "a number (for a port)", got: "foo", path: "$" }])
Port.decode(-1) // -> error([{ assertion: "not a port number", got: -1, path: "$" }])

Port.encode(1024) // -> ok(1024)
Port.encode(-1) // -> error([{ assertion: "not a port number", got: -1, path: "$" }])
```

### Test value generator

The last bit needed to instantiate a custom type is the generator function. It enables
to generate values for automated tests and to provide examples.

In order to provide a generator function we use the library `fast-check` that provides very
useful construct to define a generator.

```ts showLineNumbers
import gen from 'fast-check'

function portArbitrary(_maxDepth: number, customOptions?: PortOptions & model.BaseOptions): gen.Arbitrary<number> {
  const wellKnownPortsAllowed = customOptions?.allowWellKnownPorts ?? true
  if (wellKnownPortsAllowed) {
    return gen.integer({ min: 0, max: 65535 })
  } else {
    return gen.integer({ min: 1024, max: 65535 })
  }
}
```

This is the final definition of a new `Port` custom type.

```ts showLineNumbers
type Port = model.Infer<typeof Port>
const Port = model.custom<'port', PortOptions, number>('port', encodePort, decodePort, validatePort, portArbitrary)

const p = Port.example() //80
```

### Utility builder

In order to provide a simplier usage for the user you can defined an utility builder for every
custom type as follow:

```ts showLineNumbers
export type PortOptions = { allowWellKnownPorts: boolean }
export type PortType = model.CustomType<'port', PortOptions, number>

export function port(options?: PortOptions & model.BaseOptions): PortType {
  return model.custom({
    typeName: 'port',
    encoder: encodePort,
    decoder: decodePort,
    validator: validatePort,
    arbitrary: portArbitrary,
    options,
  })
}
```

So it can be used in as simple as other types.

```ts showLineNumbers
// Example: Using the custom `Port` type in an object definition
const serverAddress = model.object({
  address: model.string(),
  // highlight-start
  port: port({ allowWellKnownPorts: false }),
  // highlight-end
})
```





























Below is an example implementation of the `port` type that represents a TCP port.
It could also be defined as a simple integer, however, defining it as a custom
type can prove to be more expressive and it would also allow you to define custom
arbitrary decoding, encoding, and validation logic:

```ts showLineNumbers
import { validation, decoding, model } from '@mondrian-framework/model'
import gen from 'fast-check'

const MIN_PORT_NUMBER = 0
const MAX_PORT_NUMBER = 65535

export function port(options: model.BaseOptions): model.CustomType<'port', {}, number> {
  return model.custom<'port', {}, number>('port', encodePort, decodePort, validatePort, portArbitrary, options)
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

function portArbitrary(): gen.Arbitrary<number> {
  return gen.integer({ min: MIN_PORT_NUMBER, max: MAX_PORT_NUMBER })
}
```

