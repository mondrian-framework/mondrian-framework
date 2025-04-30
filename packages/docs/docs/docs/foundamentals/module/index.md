# Module

Mondrian promotes the organization of applications into self-contained, 
reusable, and composable modules.

A module is a cohesive unit with an identifying name and well-defined boundaries.
It is characterized by a set of functions whose responsibilities relate to
the same application domain.

Like functions, a module is split into a **definition** and an **implementation**. The
definition includes a name, a key-value map of all the included function definitions, and an optional version.
The implementation mainly contains the context-building logic, which is the business logic
that, given inputs provided by the runtime, creates the context required by the module's functions and their dependencies (like providers). More details
on this topic can be found in the [implementation section](./02-implementation.md).

You can also `build` a module with both its definition and implementation combined if you do not
need them separately (e.g., for generating client SDKs from just the definition). 

## Example

The following module contains four different functions imported from external files:

```ts showLineNumbers
import { result } from '@mondrian-framework/model'
import { module } from '@mondrian-framework/module'
import { 
  retrievePosts, 
  createPost, 
  updatePost, 
  deletePost 
} from '../post-functions'

const postModule = module
  .build({
    name: 'post-module',
    functions: {
      retrievePosts, 
      createPost, 
      updatePost, 
      deletePost 
    },
    context: async () => {
      return result.ok({ 
        // a context definition
      })
    },
  })
```