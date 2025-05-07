# Definition

The `@mondrian-framework/model` package contains a wide range of useful
functions for defining a domain model schema, covering everything from primitive types to complex
objects, arrays, and unions. It does so by providing a series of builders that
aim to make development straightforward and the schema as readable as possible.

Everything you might need to define a new schema is enclosed within the `model`
namespace of the `@mondrian-framework/model` package. To get started,
you should import it:

```ts showLineNumbers
import { model } from '@mondrian-framework/model'
```

## Primitives

Mondrian Framework supports the definition of a small, simple, yet powerful range
of primitive types.

```ts showLineNumbers
model.boolean()
model.string()
model.number()
model.integer()
```

Each of these can accept different parameters that refine their semantics with
options, such as common validation rules.

```ts showLineNumbers
model.string({ minLength: 1, maxLength: 256, regex: /^[1-9]\d{0,2}$/g })
model.number({ minimum: 0, exclusiveMaximum: 10000 })
model.integer({ minimum: 0, maximum: 10 })
```

Furthermore, each type constructor allows for the possibility of setting a
`description` parameter where useful text can be inserted for generating automatic
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

Besides the basic primitive types, `@mondrian-framework/model` also provides
a wide range of utility types that are already implemented and ready to use.

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
model.jwt({ iat: model.timestamp({ format: 'second' }), ... }, 'RS256') // jwt
```

## Enums

Enums allow you to define a set of named constants. Using enums can make it easier
to document intent or create a set of distinct cases. Mondrian provides support only
for string-based enums:

```ts showLineNumbers
const userKind = model.enumeration(['customer', 'admin'])
```

## Literals

Literals represent _specific_ strings, numbers, or booleans in type positions.
They are a common construct in the TypeScript language, and they are supported by
the Mondrian Framework as well:

```ts showLineNumbers
const zero = model.literal(0)
const greeting = model.literal('Hello, World!')
```

## Wrapper types

Primitive types alone wouldn't get us far in defining complex business domains.
That's why Mondrian also supports the definition of wrapper types like arrays,
optionals, and nullables that can wrap and enrich the definition of any
other type.

### Optional

The `optional()` type builder can be used to turn any type definition into the
corresponding optional type.
This means that the value of the given type can also be `undefined`, or the field might not be present if
it's assigned to a field of an [object](#objects).

Optional types can be defined by wrapping other Mondrian types:

```ts showLineNumbers
// These definitions are equivalent
const optionalString1 = model.optional(model.string())
const optionalString2 = model.string().optional()
// same as string | undefined
```

Like other Mondrian types, optionals can also accept additional options:

```ts showLineNumbers
const optional = model.number().optional({
  description: 'An optional number!',
})
```

### Nullable

Similarly to optional types, you can make any type nullable using the `nullable()`
decorator.
This means that the value of the given type can also be `null`:

```ts showLineNumbers
const nullableString1 = model.nullable(model.string())
const nullableString2 = model.string().nullable()
// same as string | null
```

### Arrays

Just like optionals and nullables, array types can be defined by wrapping another
Mondrian type.
The resulting definition describes an array whose elements are values of the wrapped type:

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
has different meanings depending on the order in which they are applied.
Note, for example, the following two cases:

```ts showLineNumbers
const nullableArrayOfStrings = model.string().array().nullable()
// same as readonly string[] | null

const arrayOfNullableStrings = model.string().nullable().array()
// same as readonly (string | null)[]
```

#### Array mutability

Being immutable by default is a sensible choice that should be suitable for almost all cases;
however, sometimes it might be necessary to define a mutable array.
To do so, one can explicitly use the `.mutable()` method:

```ts showLineNumbers
const myMutableArray = model.number().array().mutable()
// same as number[]
```

Likewise, a mutable array definition can be turned back into an immutable one
using the `.immutable()` method:

```ts showLineNumbers
const backToImmutable = myMutableArray.immutable()
// same as readonly number[]
```

## Composite types

Another key piece fundamental to achieving an expressive model is the ability
to define sum and product types.
Mondrian allows such definitions with the ability to define unions and objects.

### Objects

Objects are structured types with a set of fields. By default, an object's
fields are required and immutable (`readonly`):

```ts showLineNumbers
const myObject = model.object({
  field1: model.number(),
  field2: model.string(),
})
// same as { readonly field1: number, readonly field2: string }
```

#### Object mutability

Being immutable by default is a sensible choice that should be suitable for almost all cases;
however, sometimes it might be necessary to define an object with mutable fields.
To do so, one can use the `.mutable()` method:

```ts showLineNumbers
const myMutableObject = myObject.mutable()
// same as { field1: number, field2: string }
```

Likewise, a mutable object definition can be turned back into an immutable one
using the `.immutable()` method:

```ts showLineNumbers
const backToImmutable = myMutableObject.immutable()
// same as { readonly field1: number, readonly field2: string }
```

#### Possibly missing fields

Fields are considered required by default. To define a field that might be missing,
one can use an optional Mondrian type:

```ts showLineNumbers
const myObject = model.object({
  required: model.number(),
  optional: model.string().optional(),
})
// same as { readonly required: number, readonly optional?: string | undefined }
```

#### Complex object definitions

All the examples shown so far only use primitive and wrapper types as object
fields. However, nothing prevents you from using _any kind_ of Mondrian
type, no matter how complex it is!

An object could have primitive types, other objects, unions, or even
[custom types](#custom-types) as its fields. Let's consider a more complex
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

Entities are structured types with a set of fields, exactly like the [objects](#objects) seen previously. The main difference lies in their semantics: an entity represents a formal specification of a core domain concept (usually with an identity), while an object represents a specific structured value, often without a distinct identity.

Consider the following two different structured data types as an example: 

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

The first represents a well-defined concept in the application's domain, a user, which typically has a corresponding entry in the data model (e.g., a database table). The second, on the other hand, represents a utility or operational data structure, generally built at runtime for convenience, that doesn't refer directly to a core domain concept.

In addition to being very important from a conceptual standpoint, this distinction is crucial for parts of the framework that offer additional functionalities for processing domain entities.

### Unions

Unions are a way to define types that can hold values from a fixed set of alternative types
(usually referred to as variants).

In Mondrian, we can define a union by specifying all of its possible variants with unique keys:

```ts showLineNumbers
const myUnion = model.union({
  firstVariant: model.string(),
  secondVariant: model.number(),
})
// same as string | number
```

As you can see, the variants are tagged with keys in the definition. This tagging
is convenient for internal usage and type inference.

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

Let's work through a more complex example and see how this plays out.
In this example, we're modeling a simplified user login process:

- We receive a password and username as input.
- We send back a response that can either be successful or contain an error message:
  - If the user can be logged in, the response is successful and contains the user's information.
  - If the user cannot be logged in, the response contains an error message.

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

Given these type definitions, we can get an idea of how the login process could
work:

```ts showLineNumbers
async function loginUser(auth: AuthenticationData) {
  const user: User | null = await fetchUser(auth.username, auth.password)
  const response: LoginResponse = user ? user : { reason: 'wrong username or password' }

  await sendResponse(response)
}
```

Type definitions help us define clear and expressive models that are
faithful to the modeled domain.

## Lazy types

To model complex relationships, Mondrian offers an easy way to express recursive types using lazy evaluation (functions that return types).

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

A lazy type is any function that returns a type or another lazy type, so this is also valid:

```ts showLineNumbers
const SuperLazyString = () => () => () => model.string()
//same as string
```

A lazy type can have a reference to itself:

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

Another aspect of lazy types is that the type name is inferred from the function name.

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

The Mondrian type system is already flexible enough to express a wide variety of
useful types. However, sometimes you might find yourself needing even more flexibility:
maybe because you want to change the default type inference rules or the way a value
gets encoded, decoded, or validated. In this case, you'll need to use custom types:
a powerful way to extend Mondrian's capabilities.

As an example, the mentioned [additional types](#additional-types) are built exactly
in this way.

A custom type can be defined using the `custom` function from the `@mondrian-framework/model`
package:

```ts showLineNumbers
const MyCustomType = model.custom<"port", {}, number>(...)
```

As you may have noticed, the `custom` function takes three generic type arguments:

- The literal string representing the name of the custom type.
- The type of additional options that may be needed by the custom type,
besides the basic options shared by all Mondrian types.
- The inferred TypeScript type for the custom type ([here's](./02-typing.md)
a more thorough explanation of Mondrian's type inference).

Then, the arguments you need to pass to the `custom` builder function are:

- The name of the custom type (string).
- An encoder function that can turn values of the inferred type into a valid JSON type.
- A decoder function that can turn `unknown` values into the custom type's inferred type (or fail).
- A validator function that performs additional validation logic on values of the inferred type to ensure correctness according to the custom type's rules.
- An arbitrary function (using `fast-check`) that generates random, semantically valid values for the custom type, respecting its options.
- The specific options for this custom type instance.

### Name

Every custom type has a name that can be useful when referring to it. This is
the first argument of the `model.custom` builder function:

```ts showLineNumbers
const port = model.custom<"port", ...>("port", ...)
```

As you may have noticed, the literal string for the name must also be the first
_type argument_ provided to the `model.custom` function.

You can choose whatever name you feel is appropriate for your needs. The
Mondrian framework defines built-in custom types like `"datetime"`, `"timezone"`,
`"rgb"`, and so on.

### Additional options

Every custom type can accept additional options besides the default ones
shared by all Mondrian types. This is tracked at the type level thanks to
the second generic type argument:

```ts showLineNumbers
type PortOptions = { allowWellKnownPorts: boolean }

const Port = model.custom<"port", PortOptions, ...>("port", ...)
const nonWellKnownPort = Port.setOptions({ allowWellKnownPorts: false })
```

As we'll see later, custom options can be useful for tweaking the behavior of
the decoding and validation functions.

### Inferred type

When defining a custom type, you also have the freedom to choose the TypeScript type it
will be inferred as by Mondrian.
The inferred type is what the decoder should return upon success, and it's the input type for the
encoder:

```ts showLineNumbers
const Port = model.custom<"port", PortOptions, number>("port", ...)
const InferredType = model.Infer<typeof Port> // -> number

Port.encode(...) // encode will only accept a `number` input
Port.decode(...) // decode will return a `number` when successful
```

Here, it makes sense for ports to correspond to simple `number`s, but you may
choose any type, no matter how complex. The only constraint is that you must be able to encode it into a JSON value and decode it back from an `unknown` value.

### Encoding

When defining a new custom type, you must provide a function that can be used
to encode any value of its inferred type into a valid JSON type (`string`, `number`, `boolean`, `null`, object, or array).

This encoding function _should not perform any validation_; validation is handled
separately by the custom validator you provide later. Let's focus
on encoding and look at the example of ports:

```ts showLineNumbers
function encodePort(port: number): JSONType {
    return port
}

const Port = model.custom<"port", PortOptions, number>("port", encodePort, ...)
```

Once again, the encoder function takes a value of the inferred
type as input and transforms it into a `JSONType`. In this case, a number is already a
valid JSON type, so no further transformation is needed.

If the inferred type were more complex, say a `Date` object, you'd need to think
of a way to turn it into a JSON value. You could, for example, turn the `Date` object
into an ISO string (and later decode the string using `Date.parse`):

```ts showLineNumbers
function encodeDate(date: Date): JSONType {
  return date.toJSON() // This turns a Date object into a serializable string
}
```

### Decoding

To build a custom type, you also need to provide a custom decoding
function. You can think of decoding as the process that attempts to turn an `unknown`
value into a value of the inferred type.

The decoding function receives the `unknown` value to decode, the standard `decoding.Options`,
and the specific options defined for the custom type. These options can be used to change the
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

As you may have noticed, the decoding function must return a
`decoding.Result<InferredType>` since the process might fail. The `decoding` module provides two
useful functions for this:

- `decoding.succeed(value: InferredType)` is returned to signal a success; it takes the
  correctly decoded value as input.
- `decoding.fail(expected: string, actual: unknown)` is returned to signal a failure; it takes a
  string describing the expected value and the actual value
  it encountered as arguments.

As previously mentioned, a decoder function _should not be concerned with detailed validation_
_logic_: its primary purpose is to check if the input value has the correct basic structure or type to potentially be the inferred type, and if so, return it. Any further semantic validation _must be performed_ by the separate validator function.

For example, here we didn't check if the number is actually in the valid port range
(0-65535) because that will be done by the validator.

### Validation

Now, let's address the validation part. A validation function is
the final piece of logic needed for the `model.custom` builder to create a new
Mondrian type.

The validator takes a decoded value (of the specified inferred
type) as input, along with validation options and the custom type's options. It must return a validation result: either success or an error describing
what validation rule failed.

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

Similarly to the decoding function, a validation function must return a
`validation.Result` since the process might fail. The
`validation` module provides two useful functions:

- `validation.succeed()`, which takes no arguments and is returned when
  validation is successful.
- `validation.fail(assertion: string, actual: unknown)` is returned to signal a failure; it takes a
  string describing the assertion that failed and the actual value
  that failed the assertion as arguments.

This validator function will be used internally, in conjunction with the provided
encoder and decoder, to implement the `encode` and `decode` methods of the new custom type:

```ts showLineNumbers
type Port = model.Infer<typeof Port>
const Port = model.custom<"port", PortOptions, number>("port", encodePort, decodePort, validatePort, ...)

Port.decode(1024) // -> ok(1024)
Port.decode("foo") // -> error([{ expected: "a number (for a port)", got: "foo", path: "$" }])
Port.decode(-1) // -> error([{ assertion: "not a port number", got: -1, path: "$" }])

Port.encode(1024) // -> ok(1024)
Port.encode(-1) // -> error([{ assertion: "not a port number", got: -1, path: "$" }])
```

### Test value generator (Arbitrary)

The last piece needed to instantiate a custom type is the arbitrary generator function. This enables
the generation of random values for automated testing (e.g., property-based testing) and providing examples.

To provide a generator function, Mondrian uses the [fast-check](https://github.com/dubzzz/fast-check) library, which provides useful
constructs for defining value generators (arbitraries).

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

This completes the definition of a new `Port` custom type.

```ts showLineNumbers
type Port = model.Infer<typeof Port>
const Port = model.custom<'port', PortOptions, number>('port', encodePort, decodePort, validatePort, portArbitrary)

const p = Port.example() //80
```

### Utility builder

To provide a simpler usage experience for consumers of your custom type, you can define a utility builder function
for it, similar to Mondrian's built-in types:

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

Now it can be used as simply as other built-in types.

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

