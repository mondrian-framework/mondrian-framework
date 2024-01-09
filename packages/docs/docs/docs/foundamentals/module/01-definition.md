# Definition

In Mondrian you can define a module using the `module` namespace of the 
`@mondrian-framework/module` package. You should import it to get started:

```ts showLineNumbers
import { module } from '@mondrian-framework/module'
```

Similar to what we have already seen for functions, the `module` namespace 
provides a utility method `define`:

```ts showLineNumbers
import { 
  retrievePosts, 
  createPost, 
  updatePost, 
  deletePost 
} from '../post-functions'

const postModuleDefinition = module.define({
  name: 'post-module',
  functions: {
    retrievePosts, 
    createPost, 
    updatePost, 
    deletePost 
  }
})
```

## Name
The module `name` is a text identifier that can be used by the runtimes to discriminate and document 
it.

## Description
The module `description` is a free string useful for automatic production of documentation and technical specifications that depend on the runtime with which the module is run. It is, for example, given in the OpenAPI specification in case the module is served as a REST API.

```ts showLineNumbers
// ...
const postModuleDefinition = module.define({
  name: 'post-module',
  functions: {
    // ...
  },
  // highlight-start
  description: "Blog post module containing CRUD operations on the Post entity."
  // highlight-end
})
```

## Functions

The `functions` parameter accepts a key-value object containing all the function definitions that the module includes. 
More precisely, each key identifies a unique name of the function and the value its [definition as per the specification](../function/01-definition.md).

## Errors

A module can declare an `errors` map, with the same formalism already seen for functions. These errors can originate during context creation 
and can then occur in the invocation of any function. For this reason, any errors defined at the module level are added to the specification/documentation
of each function.

```ts showLineNumbers
// ...
const postModuleDefinition = module.define({
  name: 'post-module',
  functions: {
    // ...
  },
  // highlight-start
  errors: {
    invalidCredentials: model.string(),
    unauthorizedError: model.string()
  }
  // highlight-end
})
``
