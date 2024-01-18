import { module } from './impl/module'
import { restAPI } from './interface'
import { serve } from '@mondrian-framework/rest-fastify'
import { fastify } from 'fastify'

const server = fastify()

serve({
  api: { ...restAPI, module },
  context: async () => ({}),
  server,
  options: {
    introspection: { path: '/specs' },
  },
})

server.get('/', (_, res) => {
  res.redirect(`/specs/index.html`)
})

server.listen({ port: process.env.PORT ? Number(process.env.PORT) : 4010 }).then((address) => {
  console.log(`Server started at ${process.env.SERVER_BASE_URL ?? address}`)
})
