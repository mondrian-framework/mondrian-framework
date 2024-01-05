# Module

Mondrian promotes the organization of applications into self-contained, 
reusable and composable modules.

A module is a cohesive unit with an identifying name and well-defined boundaries.
It is characterized by a set of functions whose responsibilities are related to
the same application domain.

Like functions, a module is splitted in **definition** and **implementation**. The 
first includes a name, a key-value map of all the included functions and a version.
The second mainly contains the context building logic, that is the business logic 
that, from input provided by runtimes, creates the context for functions. More details 
on this topic in the [implementation section](./02-implementation.md).

## Example

The following module contains two different functions imported from external files:

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
  .define({
    name: 'post-module',
    description: '',
    version: '1.0.0',
    functions: {
      retrievePosts, 
      createPost, 
      updatePost, 
      deletePost 
    }
  })
  .implement({
    context: async () => {
      return result.ok({ 
        // a context definition
      })
    },
  })
```