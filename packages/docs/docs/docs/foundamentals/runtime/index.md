# Runtime

The runtime is the architectural component responsible for **executing one or more modules**. It bridges the gap between the infrastructure of the execution environment (e.g., web server, queue listener, cron job) and the requirements of the modules it runs (e.g., providing context input, handling function invocations).

Mondrian offers several standard runtimes you can use to run your application. You can also create fully customized runtimes or use those developed by the community.

Following a list of the ready-to-use runtimes currently available:
- [REST API](./API/01-REST-OpenAPI.md)
- [GraphQL API](./API/02-GraphQL-API.md)
- [gRPC API](./API/03-gRPC-API.md)
- [Apache Kafka consumer](./queue-consumer/01-Apache%20Kafka.md)
- [AWS SQS](./queue-consumer/02-AWS%20SQS.md)
- [AWS SNS](./queue-consumer/03-AWS%20SNS.md)
- [Scheduled with cron](./03-scheduled.md)
- [CLI (Command Line Interface)](./04-cli.md)

## Example

Each runtime has its own configuration and startup procedure. This example demonstrates using the REST runtime (`@mondrian-framework/rest`) with the Fastify adapter (`@mondrian-framework/rest-fastify`) to serve a module's functions as a REST API.

```ts showLineNumbers
import { rest } from '@mondrian-framework/rest'
import { serve } from '@mondrian-framework/rest-fastify'
import { fastify } from 'fastify'
import { module } from './module'

const api = rest.build({
  module: module,
  version: 1,
  functions: {
    login: { method: 'post', path: '/login' },
    writePost: { method: 'post', path: '/post' },
    readPosts: [{ method: 'get', path: '/user/{userId}/posts' }],
  }
})

const server = fastify()

serve({
  server,
  api,
  context: async ({ }) => ({ }),
})

server.listen({ port: 4000 }).then((address) => {
  console.log(`Server started at address ${address}`)
})
```


