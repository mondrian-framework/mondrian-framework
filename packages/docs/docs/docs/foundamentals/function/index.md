# Function

The second and most important construct of Mondrian is the function.
A function is the fundamental container of application logic produced by the 
developer. Everything contained in a function enjoys the decoupling and reusability
that the framework provides. 

The developer's main responsibility should be to produce functions.

Basically a function:
- has a **definition**, that includes *inputs*, *outputs* and *errors* formally defined using 
  a [domain model schema](../model/index.md).
- has an **implementation**, containing the business logic that receive the inputs and must 
  return the defined outputs. The implementation can also optionally take advantage of a 
  *context*, that is an object containing all necessary references to additional external 
  interactions managed by the execution system.

The clear division between definition and implementation is critical to allow only the definitions 
to be published to possible clients while keeping implementation details private. It, in addition 
to being a good separation practice, allows multiple implementations of the same function 
to be defined.

## Example

The following function implements the business logic to create a post
in a blogging platform:

```ts showLineNumbers
import { model } from '@mondrian-framework/model'
import { functions } from '@mondrian-framework/module'
import { Repository } from '../repository'

const PostInput = model.object({
  title: model.string({ maxLength: 200 }),
  content: model.string({ maxLength: 5000 }),
  authorId: model.string(),
})
type PostInput = model.Infer<typeof PostInput>

type Context = { repository: Repository }

const createPost = functions
  .define({
    input: PostInput,
    output: model.string(),
  })
  .implement<Context>({
    async body({ input, context }) {    
      const postId = await context.repository.posts.insertOne(input)
      return postId
    },
  })
```