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

const postModule = module.define({
  name: 'post-module',
  version: '1.0.0',
  functions: {
    retrievePosts, 
    createPost, 
    updatePost, 
    deletePost 
  }
})
```

## Name

## Version

## Functions

## Errors
