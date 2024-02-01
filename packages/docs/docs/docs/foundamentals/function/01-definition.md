# Definition

In Mondrian you can define a function using the `@mondrian-framework/module` package. 
Everything you may need to do it is enclosed inside the `functions` namespace, so to 
get things started you should import it:

```ts showLineNumbers
import { functions } from '@mondrian-framework/module'
```

The definition of a function contains all and only the informations necessary to establish 
the contract between the caller and the developer. It therefore contains 
no details about its behavior or where it will be executed.

Anything included in the definition may be subject to publication, so it must not contain 
private details.

The `functions` namespace provides a utility method `define` for this purpose:

```ts showLineNumbers
const createPost = functions.define({
  input: model.object({
    title: model.string(),
    content: model.string(),
    authorId: model.string(),
  }),
  output: model.string(),
})
```

## Inputs

The first thing to define in a function is its input. Mondrian provides a single input 
parameter, which can be defined inline as in the example above or taken from a constant 
defined somewhere earlier.

Any type that can be defined via `@mondrian-framework/model` can be used as input: 
primitives, objects, entities, arrays, and unions. unions can be particularly useful 
in the case of functions that can accept input of different types.

```ts showLineNumbers
const CustomerUserInput = model.object(...)
const SellertUserInput = model.object(...)

const registerUser = functions.define({
  input: model.union({
    customer: CustomerUserInput,
    seller: SellerUserInput,
  }),
  output: model.string(),
})
```

A function can also receive no input, in which case the `undefined` type can be used, or the input definition can be omitted.
```ts showLineNumbers
const generateRandomString = functions.define({
  output: model.string(),
})
```

## Outputs
Exactly as with inputs, Mondrian provides a second parameter to define the output 
of a function. Again, the output can be a primitive, an objects, an entity, an 
array or a union.

```ts showLineNumbers
const User = ...

const getAllUsers = functions.define({
  output: model.array(User),
})
```

In the case where the function has no output, i.e. is *void*, the output type must be 
defined as `undefined` or be omitted.

```ts showLineNumbers
const setNewPassword = functions.define({
  input: model.string(),
})
```

## Retrieve entities

Many times the output of a function is an [entity](../model//01-definition.md#entities) or an 
array of entities. In these cases it is common for one or more inputs to be linked to the expected 
output.

Assume, for example, a function to retrieve a list of users. It may have as input:
- The selection of fields required for each user as a projection of its complete structure
- A filter that narrows the set of required users based on certain conditions
- A sorting logic
- The number of records to be returned or the index / number of the first record to be returned

All of these **inputs are closely related to the output entity** and give additional details 
about how the function should retrieve and output it.  

You can freely define these inputs in the standard way, using `mondrian-framework/model`
and the input parameter. Alternatively, Mondrian framework offers the possibility of defining them 
automatically, with a standard structure, leaving the developer simply to choose whether or 
not to activate them. This option, in addition to convenience, allows these inputs to be treated 
differently, opening up the possibility of creating automatic logic on them, in conjunction with 
the entity model to which they refer. It is possible, for example, to create a security middleware 
based on access policies defined on the entity that check these inputs for allowance, or to automatically 
translate filters and fields selection to an ORM format. You can also imagine a lot of other scenarios.

These inputs can be activated individually through a `retrieve` parameter in the function definition.

```ts showLineNumbers
const User = model.entity({
  id: model.number(),
  firstName: model.string(),
  lastName: model.string(),
})

const retrieveUsers = functions.define({
  output: model.array(User),
  // highlight-start
  retrieve: {
    where: true,
    select: true,
    orderBy: true,
    take: true,
    skip: true,
  },
  // highlight-end
})
```

By activating them, the function implementation now can receive an additional `retrieve` parameter 
which, in the above example, will have the following (simplified) type:

```ts showLineNumbers
type UserRetrieveType = {
  where?: {
    id?: { 
      equals?: number,
      in?: number[]
    },
    firstName?: { 
      equals?: string,
      in?: string[]
    },
    lastName?: { 
      equals?: string,
      in?: string[]
    }
  },
  select?: {
    id?: boolean,
    firstName?: boolean,
    lastName?: boolean
  } | true,
  orderBy?: { 
    id?: 'asc' | 'desc',
    firstName?: 'asc' | 'desc',
    lastName?: 'asc' | 'desc'
  }[],
  take?: number,
  skip?: number
}
```

A more detailed documentation of the semantics of each of these inputs follows.

#### Where
The `where` parameter identifies a filter on the output entity. The number and type of filters that 
can be created on an entity is extremely large and varied, Mondrian therefore chooses a basic 
subset of them, typically offered by popular ORMs. 

#### Select
The `select` parameter identifies a selection of the entity's fields, a projection of its structure. 
It is typical of API contexts where the client can select a subset of the output fields for performance 
issues, e.g. on GraphQL.

To select a field you must specify its key and value `true` and conversely `false` to exclude it.

#### Order By
The `orderBy` parameter is used to indicate a sorting of output records. It generally only makes 
sense if the output is an array of entities. You can define an array of sorts and the direction of
every item.

#### Take
`take` is an integer that simply indicates the maximum number of records to be returned.

#### Skip
`skip` is an integer that indicates the number of records to skip.

:::info
For all these parameters, instead of designing a completely proprietary syntax, we chose to use the 
same syntax defined by the [Prisma](https://www.prisma.io/).

Prisma is an open source ORM written in TypeScript that is extremely popular in the NodeJS ecosystem
and compatible with both major SQL databases and MongoDB. Given its widespread use, we chose to follow 
its syntax, which is rather agnostic to their product, of way to simplify its use, even make it transparent. 
Nothing precludes that, given a formal definition of the output model and these retrieve inputs, it is 
possible to build a utility function that translates them to other libraries, existing or future.
:::


## Errors
We believe that the best way to handle errors is to do so in a way that preserves their 
structure and typing, just as with any other output. That is why the framework allows you to define, 
for each function, a map of possible errors and related schema types.

```ts showLineNumbers
const retrieveUser = functions.define({
  input: model.object({
    id: model.string()
  }),
  output: User,
  // highlight-start
  errors: {
    userNotFound: model.literal('User not found.'),
    invalidId: model.literal('Given ID is not valid.')
  },
  // highlight-end
})
```

The details attached to an error can be as complex as desired to contain 
additional data better explaining it.

```ts showLineNumbers
const retrieveUser = functions.define({
  input: model.object({
    id: model.string()
  }),
  output: User,
  errors: {
    userNotFound: model.literal('User not found.'),
    invalidId: model.literal('Given ID is not valid.')
    // highlight-start
    userNoLongerRegistered: model.object({
      message: model.literal('User no longer registered.'),
      deregistrationDate: model.timestamp()
    })
    // highlight-end
  },
})
```

This definition will then allow you to [implement the behavior](./02-implementation.md) of the function by 
ensuring type checking on the return of any errors as well.

Mondrian also offers a utility method for a more concise definition of errors, which allows fields with default values, 
such as a message, to be added.

```typescript
import { error } from '@mondrian-framework/module'

const retrieveUser = functions.define({
  input: model.object({
    id: model.string()
  }),
  output: User,
  errors: error.define(
    {
      userNotFound: { message: 'User not found.' },
      invalidId: { message: 'Given ID is not valid.' },
      unauthorized: {
        message: 'Unauthorised access.',
        reason: model.enumeration(['InvalidJwt', 'AuthorizationMissing']),
      }
    }
  ),
})
```

Using this utility we define a map of errors the function can return, and for some of them we also set default values
of the field message. The difference between the previous example is that you in this second way, there is no need 
to specify the message every time you want to use the error.

## Options

The definition of a function provides a last optional parameter called `options` through which the developer 
can specify additional metadata that may be useful at some runtime. In any case, these options are intrinsically 
linked to the nature of the function.

```ts showLineNumbers
const getAllUsers = functions.define({
  output: model.array(User),
  // highlight-start
  options: {
    namespace: 'registry',
    description: 'Returns all the user already registered to the system registry.'
  }
  // highlight-end
})
```

#### Namespace
The `namespace` parameter represent an optional logical subgrouping of a module that can be useful to further subdivide a set of functions.

This option is used by some runtimes, for example [@mondrian-framework/rest](../runtime//API/01-REST-OpenAPI.md) and [@mondrian-framework/graphql](../runtime/API/02-GraphQL-API.md), where there is a concept of API grouping in the respective specifications.

#### Description
The `description` parameter is a simple plain string where you can describe the function business logic and behaviour in natual language. This value is added to API specifications and generally reported on the documentation produced from this definition.
