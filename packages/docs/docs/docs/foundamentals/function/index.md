# Function

The second and most important construct of Mondrian is the function.
A function, produced by the developer, is the fundamental container of application logic.
Everything contained in a function benefits from the decoupling and reusability
that the framework provides. Referring to a Clean Architecture model, a function is the
implementation of a use case.

The main responsibility of the developer should be to produce functions.

Basically a function:

- has a **definition**, that includes _inputs_, _outputs_ and _errors_ formally defined using
  a [domain model schema](../model/index.md).
- has an **implementation**, containing the business logic that receive the inputs and must
  return the defined outputs.

The clear division between definition and implementation is critical, as it allows only the
definitions to be published to potential clients, keeping the implementation details private.
In addition to being a good practice for separation of concerns, it allows for multiple
implementations of the same function to be defined.

## Example

The following function implements the business logic for creating a post on a blogging platform:

```ts showLineNumbers
import { Repository } from '../repository'
import { model, result } from '@mondrian-framework/model'
import { functions } from '@mondrian-framework/module'

const PostInput = model.object({
  title: model.string({ maxLength: 200 }),
  content: model.string({ maxLength: 5000 }),
  authorId: model.string(),
})
type PostInput = model.Infer<typeof PostInput>

const createPost = functions
  .define({
    input: PostInput,
    output: model.string(),
  })
  .implement({
    async body({ input }) {
      // const postId = ...
      return result.ok(postId)
    },
  })
```
