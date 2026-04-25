# Definition

In Mondrian, you can define a module using the `module` namespace from the
`@mondrian-framework/module` package. You should import it to get started:

```ts showLineNumbers
import { module } from '@mondrian-framework/module'
```

Similar to what we have already seen for functions, the `module` namespace
provides a `define` utility method:

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
The module `name` is a string identifier that can be used by runtimes to discriminate and document
it.

## Description
The module `description` is an optional string useful for the automatic production of documentation and technical specifications that depend on the runtime with which the module is executed. It is, for example, included in the OpenAPI specification if the module is served as a REST API.

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

The `functions` parameter accepts a key-value object containing all the function definitions included in the module.
More precisely, each key identifies the unique name of the function within the module, and the value is its [function definition](../function/01-definition.md).

## Errors

A module definition can declare an `errors` map, using the same formalism already seen for functions. These errors represent potential failures that can originate during the module's context creation phase (defined in the implementation)
and could therefore occur during the invocation of any function within the module. For this reason, any errors defined at the module level are automatically added to the specification and documentation
of each function in that module.

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
```
