# Function

The second and most important construct of Mondrian is the function.
A function is the fundamental container of application logic produced by the 
developer. Everything contained in a function enjoys the decoupling and reusability
that the framework provides. 

The developer's main responsibility should be to produce functions.

Basically a function:
- has **inputs** and **outputs**, that you can formally define using 
  a [domain model schema](../model/index.md).
- has a **context**, as the function's single point of contact, extensible and customizable, 
  for external interactions in addition to its own inputs and outputs.
- has a **body** containing the business logic that receive the inputs and the context 
  as parameters and must return the outputs.

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

const createPost = functions.withContext<Context>().build({
  input: PostInput,
  output: model.string(),
  async body({ input, context }) {    
    const postId = await context.repository.posts.insertOne(input)
    return postId
  },
})

```