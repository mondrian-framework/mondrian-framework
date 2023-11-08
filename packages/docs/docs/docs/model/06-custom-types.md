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

As a running example, we're going to have a look at a custom type describing
TCP ports.

### Custom types are named

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

### Custom types can have additional options

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

### Custom types can be inferred as any type

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

### Custom types have arbitrary encoding logic

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

### Custom types have arbitrary decoding logic

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

### Custom types have arbitrary validation logic

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

const Port = model.custom<"port", PortOptions, number>("port", encodePort, decodePort, validatePort)
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
const Port = model.custom<"port", PortOptions, number>("port", encodePort, decodePort, validatePort)

Port.decode(1024) // -> ok(1024)
Port.decode("foo") // -> error([{ expected: "a number (for a port)", got: "foo", path: "$" }]) 
Port.decode(-1) // -> error([{ assertion: "not a port number", got: -1, path: "$" }]) 

Port.encode(1024) // -> ok(1024)
Port.encode(-1) // -> error([{ assertion: "not a port number", got: -1, path: "$" }]) 
```
