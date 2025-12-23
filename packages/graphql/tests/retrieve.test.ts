import { build } from '../src/api'
import { fromModule } from '../src/graphql'
import { model, result } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'
import { createYoga } from 'graphql-yoga'
import http from 'node:http'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

// ============================================
// Entity Definitions with Relations
// ============================================

const Comment = () =>
  model.entity({
    id: model.string(),
    content: model.string(),
    author: Author,
    createdAt: model.datetime(),
  })
type Comment = model.Infer<typeof Comment>

const Post = () =>
  model.entity({
    id: model.string(),
    title: model.string(),
    content: model.string(),
    author: Author,
    comments: model.array(Comment).mutable(),
    publishedAt: model.datetime().optional(),
  })
type Post = model.Infer<typeof Post>

const Author = () =>
  model.entity({
    id: model.string(),
    name: model.string(),
    email: model.email(),
    posts: model.array(Post).mutable(),
    bio: model.string().optional(),
  })
type Author = model.Infer<typeof Author>

// ============================================
// Functions with Retrieve
// ============================================

const getAuthor = functions
  .define({
    input: model.string(),
    output: Author,
    retrieve: { select: true },
  })
  .implement({
    body: async ({ input, retrieve }) => {
      const author: Author = {
        id: input,
        name: 'John Author',
        email: 'john@example.com',
        posts: [],
        bio: 'A prolific writer',
      }

      if (retrieve.select?.posts) {
        const post: Post = {
          id: 'post-1',
          title: 'My First Post',
          content: 'Hello World',
          author,
          comments: [],
        }
        author.posts.push(post)

        if ((retrieve.select.posts as any)?.select?.comments) {
          const comment: Comment = {
            id: 'comment-1',
            content: 'Great post!',
            author,
            createdAt: new Date('2024-01-01'),
          }
          post.comments.push(comment)
        }
      }

      return result.ok(author)
    },
  })

const getPosts = functions
  .define({
    output: model.array(Post),
    retrieve: { select: true, take: true, skip: true },
    options: { operation: 'query' },
  })
  .implement({
    body: async ({ retrieve }) => {
      const author: Author = {
        id: 'author-1',
        name: 'Jane Author',
        email: 'jane@example.com',
        posts: [],
      }

      const posts: Post[] = Array.from({ length: 10 }, (_, i) => ({
        id: `post-${i + 1}`,
        title: `Post ${i + 1}`,
        content: `Content for post ${i + 1}`,
        author,
        comments: [],
        publishedAt: new Date(`2024-01-${String(i + 1).padStart(2, '0')}`),
      }))

      const skip = retrieve.skip ?? 0
      const take = retrieve.take ?? posts.length
      return result.ok(posts.slice(skip, skip + take))
    },
  })

// Note: TotalCountArray is tested in the main graphql.test.ts
// Here we test regular arrays with pagination

// ============================================
// Module Setup
// ============================================

const retrieveTestModule = module.build({
  name: 'retrieve-tests',
  options: { maxSelectionDepth: 4 },
  functions: {
    getAuthor,
    getPosts,
  },
})

type ServerContext = { req: http.IncomingMessage; res: http.ServerResponse }

const schema = fromModule({
  api: build({
    module: retrieveTestModule,
    functions: {
      getAuthor: { type: 'query' },
      getPosts: { type: 'query' },
    },
  }),
  context: async () => ({}),
})

const yoga = createYoga<ServerContext>({ schema, maskedErrors: false })

describe('GraphQL Retrieve Tests', () => {
  const server = http.createServer(yoga)
  const PORT = 50129

  beforeAll(() => {
    server.listen(PORT)
  })

  afterAll(() => {
    server.close()
  })

  async function makeRequest(query: string): Promise<{ status: number; body: any }> {
    const res = await fetch(`http://127.0.0.1:${PORT}/graphql`, {
      method: 'post',
      body: JSON.stringify({ query }),
      headers: { 'Content-Type': 'application/json' },
    })
    return { status: res.status, body: await res.json() }
  }

  describe('Selection', () => {
    test('basic field selection', async () => {
      const res = await makeRequest(`
        query {
          getAuthor(input: "author-1") {
            id
            name
          }
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.data.getAuthor).toEqual({
        id: 'author-1',
        name: 'John Author',
      })
    })

    test('nested selection - one level', async () => {
      const res = await makeRequest(`
        query {
          getAuthor(input: "author-1") {
            id
            name
            posts {
              id
              title
            }
          }
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.data.getAuthor.posts).toHaveLength(1)
      expect(res.body.data.getAuthor.posts[0]).toEqual({
        id: 'post-1',
        title: 'My First Post',
      })
    })

    test('deeply nested selection', async () => {
      const res = await makeRequest(`
        query {
          getAuthor(input: "author-1") {
            id
            posts {
              id
              comments {
                id
                content
              }
            }
          }
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.data.getAuthor.posts[0].comments).toHaveLength(1)
      expect(res.body.data.getAuthor.posts[0].comments[0]).toEqual({
        id: 'comment-1',
        content: 'Great post!',
      })
    })
  })

  describe('Pagination (take/skip)', () => {
    test('uses take to limit results', async () => {
      const res = await makeRequest(`
        query {
          getPosts(take: 3) {
            id
            title
          }
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.data.getPosts).toHaveLength(3)
      expect(res.body.data.getPosts[0].id).toBe('post-1')
      expect(res.body.data.getPosts[2].id).toBe('post-3')
    })

    test('uses skip to offset results', async () => {
      const res = await makeRequest(`
        query {
          getPosts(skip: 5, take: 3) {
            id
          }
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.data.getPosts).toHaveLength(3)
      expect(res.body.data.getPosts[0].id).toBe('post-6')
    })

    test('skip without take returns remaining items', async () => {
      const res = await makeRequest(`
        query {
          getPosts(skip: 8) {
            id
          }
        }
      `)
      expect(res.status).toBe(200)
      expect(res.body.data.getPosts).toHaveLength(2)
    })
  })
})
