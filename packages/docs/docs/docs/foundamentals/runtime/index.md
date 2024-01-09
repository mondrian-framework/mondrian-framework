# Runtime

The runtime is the component of the architecture that is responsible for **executing one or more modules**. It must cover the gap between the infrastructure of the execution environment and the requirements of the modules.

Mondrian offers a number of standard runtimes from which you can draw to run your application. To these you can then add fully customized ones or draw from those produced by the community.

Following a list of the ready-to-use runtimes currently available:
- [REST API](./API/01-REST-OpenAPI.md)
- [GraphQL API](./API/02-GraphQL-API.md)
- [gRPC API](./API/03-gRPC-API.md)
- [Apache Kafka consumer](./queue-consumer/01-Apache%20Kafka.md)
- [AWS SQS](./queue-consumer/02-AWS%20SQS.md)
- [AWS SNS](./queue-consumer/0-AWS%20SNS.md)
- [Scheduled with cron](./03-scheduled.md)
- [CLI (Command Line Interface)](./04-cli.md)

## Example

Each runtime has its own configuration and its own way of being started. In this example we show the use of a runtime that allows serving the functions of a module as a REST API using [Fastify](https://fastify.dev/).

```ts showLineNumbers
import { rest } from '@mondrian-framework/rest'
import { serve } from '@mondrian-framework/rest-fastify'
import { fastify } from 'fastify'
import { module } from './module'

const server = fastify()

const api = rest.build({
  module: module,
  version: 1,
  functions: {
    login: { method: 'post', path: '/login' },
    writePost: { method: 'post', path: '/post' },
    readPosts: [{ method: 'get', path: '/user/{userId}/posts' }],
  }
})

serve({
  server,
  api,
  context: async ({ }) => ({ }),
})
```


