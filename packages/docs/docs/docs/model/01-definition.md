# Definition

The `@mondrian-framework/model` package contains a wide range of useful functions for defining a data model schema, from the simplest type `string` to complex objects, arrays, and unions. The syntax used has been designed to make development straightforward and the schema as readable as possible.

## Primitives
Mondrian Framework supports the definition of a really small, simple but powerfull range of primitive types.

```ts showLineNumbers
m.boolean()
m.string()
m.number()
m.integer()
m.datetime() // ISO 8601
m.timestamp() // unixtime (ms)
m.null()
m.void()
```

Each of these can accept different params that can refine their semantics with some options, like common validation rules.

```ts showLineNumbers
m.string({ minLength: 5, maxLength: 256, regex: /^[1-9]\d{0,2}$/g })
m.number({ minimum: 0, maximum: 10000, multiplierOf: 10 })
m.integer({ minimum: 0, maximum: 10 })
m.datetime({ minimum: new Date(2023, 0, 1), maximum: new Date() })
m.timestamp({ minimum: new Date(2023, 0, 1), maximum: new Date() })
```

Furthermore, each function allows for the possibility of setting a description parameter where useful text can be inserted for generating automatic documentation of the model.

```ts showLineNumbers
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
Besides primitive types, the framework provides a wide range of utility types that are already implemented and ready to use. In order to minimize packages size and required dependencies, these advanced types are provided in a separate package named `@mondrian-framework/advanced-types`.

```ts showLineNumbers
import m from '@mondrian-framework/advanced-types'

m.countryCode() // ISO 3166-1 alpha-2
m.currency() // ISO 4217
m.date() // date string without time
m.email() 
m.IP() // IPv4 or IPv6 address
m.ISBN() // ISBN-10 or ISBN-13
m.JWT() // Json Web Token
m.latitude() 
m.locale() // ISO 639-1
m.longitude()
m.MAC() // IEEE 802 48-bit
m.phoneNumber() // E.164
m.port() // TCP port
m.time() // time only string RFC 3339
m.timezone() // IANA Time Zone
m.URL() // RFC 3986
m.UUID() // Universal Unique Identifier
```
## Custom types

## Enums
Enums allow a developer to define a set of named constants. Using enums can make it easier to document intent, or create a set of distinct cases. Mondrian provides only string-based enums.

```ts showLineNumbers
const UserType = m.enum(['CUSTOMER', 'ADMIN'])
```

## Literals
Literals represent <em>specific</em> strings or numbers in type positions. They are a common construct in the TypeScript language.
```ts showLineNumbers
const Zero = m.literal(0)
const Hello = m.literal('Hello')
```

## Optional
You can make any type optional with an `optional()` decorator. This means that the given type can be also `undefined`, or not specified if assigned to a field of an [object](#objects).

```ts
const OptionalString = m.optional(m.string())
```
For convenience, you can also call the `optional()` method on an existing type.

```ts
const OptionalString = m.string().optional()
```

## Nullable
Similarly, you can make any type nullable with a `nullable()` decorator. This means that the given type can be also `null`.

```ts
// two equivalent defintions
const NullableString = m.nullable(m.string())
const NullableString = m.string().nullable()
```

## Default
Another useful feature is the `.default()` decorator, that can receive a value or a function parameter. The default value is applied during the [decode](./04-decode.md) phase if the input of the decorated type is `undefined`.

```ts
import { m, decode } from '@mondrian-framework/model'

const NumberDefaultZero = m.number().default(0)
const NumberDefaultRandom = m.number().default(Math.random)

m.decode(NumberDefaultZero, undefined) // => 0
m.decode(NumberDefaultRandom, undefined) // => 0.4413456736055323
```

## Objects
Objects are structured types with a set of fields, required by default.
```ts showLineNumbers
const User = m.object({
  id: m.integer(),
  name: m.string(),
  surname: m.string(),
  email: m.string().optional(),
  dateOfBirth: m.datetime().optional(),
})
```
Fields can be [primitive types](#primitives), as in the previous example, [advanced types](#advanced-types), [custom types](#custom-types) or other objects. In the latter case, they can be declared separately to be used multiple times or inline.
```ts showLineNumbers
// highlight-start
const Address = m.object({
  street: m.integer(),
  city: m.string(),
  zipcode: m.string(),
  country: m.string(),
})
// highlight-end

const User = m.object({
  id: m.integer(),
  name: m.string(),
  surname: m.string(),
  email: m.string().optional(),
  dateOfBirth: m.datetime(.optional()),
  // highlight-start
  credentials: m.object({
    username: m.string(),
    password: m.password(),
  }),
  address: Address.optional(),
  // highlight-end
})
```

## Arrays
Arrays are managed through a decorator that accept an optional parameter that defines maximum number of allowed elements.

```ts showLineNumbers
 // two equivalent defintions
const ArrayOfStrings = m.array(m.string())
const ArrayOfStrings = m.string().array()

const ArrayOfMaxFiveStrings = m.string().array({ maxItems: 5 })

const User = m.object({
  id: m.integer(),
  name: m.string(),
  surname: m.string(),
  // highlight-start
  emails: m.string().array(),
  // highlight-end
})
```

Combining the `array` decorator with others like `optional`, `nullable`, and `default` assumes different meanings depending on the order in which they are applied. Note, for example, the following two cases: 

```ts showLineNumbers
import { m, decode } from '@mondrian-framework/model'

const NullableArrayOfStrings = m.string().array().nullable()
const ArrayOfNullableStrings = m.string().nullable().array()

decode(NullableArrayOfStrings, null) // => null
decode(NullableArrayOfStrings, [null]) // => error

decode(ArrayOfNullableStrings, null) // => error
decode(ArrayOfNullableStrings, [null]) // => [null]
```
## Unions

## Reference

## Select

## Merge

## Recursion 