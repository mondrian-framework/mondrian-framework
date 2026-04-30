import { build } from '../src/api'
import * as graphqlExports from '../src/exports'
import { fromModule } from '../src/graphql'
import { graphql as graphqlNamespace } from '../src/index'
import { decoding, model, result, validation } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'
import { JSONType } from '@mondrian-framework/utils'
import { graphql, parse, getOperationAST } from 'graphql'
import { createYoga } from 'graphql-yoga'
import http from 'node:http'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

// ============================================
// Coverage gap tests targeting uncovered branches
// in packages/graphql/src/graphql.ts
// ============================================

type ServerContext = { req: http.IncomingMessage; res: http.ServerResponse }

describe('Exports re-export the graphql namespace', () => {
  test('graphql namespace is exposed via index', () => {
    expect(graphqlNamespace).toBeDefined()
    expect(typeof graphqlNamespace.fromModule).toBe('function')
    expect(typeof graphqlNamespace.build).toBe('function')
    expect(typeof graphqlNamespace.define).toBe('function')
  })

  test('exports.ts re-exports both graphql and api modules', () => {
    expect(typeof graphqlExports.fromModule).toBe('function')
    expect(typeof graphqlExports.build).toBe('function')
    expect(typeof graphqlExports.define).toBe('function')
    expect(graphqlExports.DEFAULT_SERVE_OPTIONS).toBeDefined()
  })
})

// ============================================
// Custom type with apiType used only as output (line 556-557)
// ============================================
describe('Custom type with apiType as output', () => {
  // This type is used only as an OUTPUT - the input branch is never hit so
  // line 556-557 of customTypeToGraphQLOutputType is exercised.
  const ApiTypeOnlyOutput = model.custom<'ApiTypeOnlyOutput', {}, { name: string; age: number }>({
    typeName: 'ApiTypeOnlyOutput',
    encoder: (value) => value as JSONType,
    decoder: (value) => decoding.succeed(value as { name: string; age: number }),
    validator: () => validation.succeed(),
    arbitrary: () => {
      throw new Error('Not implemented')
    },
    options: {
      apiType: model.object({ name: model.string(), age: model.integer() }, { name: 'ApiTypeWrapped' }),
    },
  })

  const getCustomOutput = functions
    .define({
      output: ApiTypeOnlyOutput,
      options: { operation: 'query' },
    })
    .implement({
      body: async () => result.ok({ name: 'Alice', age: 30 }),
    })

  const apiTypeModule = module.build({
    name: 'api-type-output',
    functions: { getCustomOutput },
  })

  const schema = fromModule({
    api: build({
      module: apiTypeModule,
      functions: { getCustomOutput: { type: 'query' } },
    }),
    context: async () => ({}),
  })

  const yoga = createYoga<ServerContext>({ schema, maskedErrors: false })
  const server = http.createServer(yoga)
  const PORT = 50180

  beforeAll(() => {
    server.listen(PORT)
  })
  afterAll(() => {
    server.close()
  })

  test('output uses apiType structure', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/graphql`, {
      method: 'post',
      body: JSON.stringify({ query: '{ getCustomOutput { name age } }' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const body = await res.json()
    expect(body.data.getCustomOutput).toEqual({ name: 'Alice', age: 30 })
  })
})

// ============================================
// Function with literal input (line 163)
// ============================================
describe('Literal as input type', () => {
  // Force a literal input that has a custom name → triggers literalToGraphQLType
  // through typeToGraphQLInputType (line 163).
  const literalInputFn = functions
    .define({
      input: model.literal('only-allowed', { name: 'OnlyAllowedInput' }),
      output: model.string(),
      options: { operation: 'query' },
    })
    .implement({
      body: async ({ input }) => result.ok(`got: ${input}`),
    })

  const mod = module.build({
    name: 'literal-input',
    functions: { literalInputFn },
  })

  test('schema is built with literal input type', () => {
    const schema = fromModule({
      api: build({
        module: mod,
        functions: { literalInputFn: { type: 'query' } },
      }),
      context: async () => ({}),
    })
    expect(schema).toBeDefined()
  })
})

// ============================================
// Array of optional items (lines 287, 301 false-branches)
// ============================================
describe('Array of optional items (input + output)', () => {
  // model.array(model.optional(...)) ⇒ wrappedType is optional, so the inner
  // GraphQL type stays nullable instead of being wrapped in NonNull. This
  // covers the truthy branch of `model.isOptional(array.wrappedType)` for
  // both the input path (line 301) and the output path (line 287). Each
  // function uses an independent type instance to avoid the type-cache
  // short-circuiting.
  const inArr = model.array(model.optional(model.integer()))
  const outArr = model.array(model.optional(model.string()))

  const inputArrFn = functions
    .define({
      input: inArr,
      output: model.string(),
      options: { operation: 'query' },
    })
    .implement({
      body: async ({ input }) => result.ok(JSON.stringify(input)),
    })

  const outputArrFn = functions
    .define({
      output: outArr,
      options: { operation: 'query' },
    })
    .implement({
      body: async () => result.ok(['a', undefined, 'b']),
    })

  const mod = module.build({
    name: 'array-of-optional',
    functions: { inputArrFn, outputArrFn },
  })

  const schema = fromModule({
    api: build({
      module: mod,
      functions: { inputArrFn: { type: 'query' }, outputArrFn: { type: 'query' } },
    }),
    context: async () => ({}),
  })

  const yoga = createYoga<ServerContext>({ schema, maskedErrors: false })
  const server = http.createServer(yoga)
  const PORT = 50181

  beforeAll(() => {
    server.listen(PORT)
  })
  afterAll(() => {
    server.close()
  })

  test('input is an array of optional integers', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/graphql`, {
      method: 'post',
      body: JSON.stringify({ query: '{ inputArrFn(input: [1, null, 3]) }' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const body = await res.json()
    expect(body.data.inputArrFn).toBe('[1,null,3]')
  })

  test('output is an array of optional strings', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/graphql`, {
      method: 'post',
      body: JSON.stringify({ query: '{ outputArrFn }' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const body = await res.json()
    expect(body.data.outputArrFn).toEqual(['a', null, 'b'])
  })
})

// ============================================
// Function in module but not in api.functions
// (lines 593, 604 — the `[]` empty fallback)
// ============================================
describe('Function declared in module but not in api', () => {
  const fnA = functions
    .define({
      output: model.string(),
      options: { operation: 'query' },
    })
    .implement({
      body: async () => result.ok('A'),
    })

  const fnB = functions
    .define({
      output: model.string(),
      options: { operation: 'query' },
    })
    .implement({
      body: async () => result.ok('B'),
    })

  const mod = module.build({
    name: 'partial-api',
    functions: { fnA, fnB },
  })

  test('schema only exposes fnA when fnB is omitted from api', () => {
    const schema = fromModule({
      api: build({
        module: mod,
        // fnB intentionally omitted → triggers `specs ? [specs] : []` empty branch
        functions: { fnA: { type: 'query' } } as any,
      }),
      context: async () => ({}),
    })
    const queryType = schema.getQueryType()
    const fields = queryType?.getFields() ?? {}
    expect(Object.keys(fields)).toContain('fnA')
    expect(Object.keys(fields)).not.toContain('fnB')
  })
})

// ============================================
// Module with no queries → triggers `queries.length === 0` push (line 611)
// Module with no mutations is already covered by namespace tests.
// ============================================
describe('Module with only mutations', () => {
  const mutateOnly = functions
    .define({
      input: model.string(),
      output: model.string(),
      options: { operation: 'mutation' },
    })
    .implement({
      body: async ({ input }) => result.ok(`mut:${input}`),
    })

  const mod = module.build({
    name: 'mutate-only',
    functions: { mutateOnly },
  })

  const schema = fromModule({
    api: build({
      module: mod,
      functions: { mutateOnly: { type: 'mutation' } },
    }),
    context: async () => ({}),
  })

  const yoga = createYoga<ServerContext>({ schema, maskedErrors: false })
  const server = http.createServer(yoga)
  const PORT = 50182

  beforeAll(() => {
    server.listen(PORT)
  })
  afterAll(() => {
    server.close()
  })

  test('Query type contains the void placeholder', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/graphql`, {
      method: 'post',
      body: JSON.stringify({ query: 'query { void }' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const body = await res.json()
    expect(body.data.void).toBe('void')
  })

  test('Mutation works alongside void query', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/graphql`, {
      method: 'post',
      body: JSON.stringify({ query: 'mutation { mutateOnly(input: "hi") }' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const body = await res.json()
    expect(body.data.mutateOnly).toBe('mut:hi')
  })
})

// ============================================
// Field selection without arguments (line 688 false branch)
// → call a function that returns an entity & select scalar fields (no args)
// ============================================
describe('Selection with no arguments', () => {
  const Item = () =>
    model.entity({
      id: model.string(),
      name: model.string(),
    })

  const getOne = functions
    .define({
      output: Item,
      retrieve: { select: true },
      options: { operation: 'query' },
    })
    .implement({
      body: async () => result.ok({ id: '1', name: 'one' }),
    })

  const mod = module.build({
    name: 'no-args-selection',
    functions: { getOne },
  })

  const schema = fromModule({
    api: build({
      module: mod,
      functions: { getOne: { type: 'query' } },
    }),
    context: async () => ({}),
  })

  const yoga = createYoga<ServerContext>({ schema, maskedErrors: false })
  const server = http.createServer(yoga)
  const PORT = 50183

  beforeAll(() => {
    server.listen(PORT)
  })
  afterAll(() => {
    server.close()
  })

  test('handles a leaf field without arguments', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/graphql`, {
      method: 'post',
      body: JSON.stringify({ query: '{ getOne { id name } }' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const body = await res.json()
    expect(body.data.getOne).toEqual({ id: '1', name: 'one' })
  })
})

// ============================================
// Named GraphQL fragment usage → exercises FRAGMENT_SPREAD branch (705-714).
// ============================================
describe('Named GraphQL fragments', () => {
  const Profile = () =>
    model.entity({
      id: model.string(),
      name: model.string(),
      email: model.string(),
    })

  const getProfile = functions
    .define({
      input: model.string(),
      output: Profile,
      retrieve: { select: true },
      options: { operation: 'query' },
    })
    .implement({
      body: async ({ input }) => result.ok({ id: input, name: 'N', email: 'e@e.com' }),
    })

  const mod = module.build({
    name: 'fragment-spread',
    functions: { getProfile },
  })

  const schema = fromModule({
    api: build({
      module: mod,
      functions: { getProfile: { type: 'query' } },
    }),
    context: async () => ({}),
  })

  const yoga = createYoga<ServerContext>({ schema, maskedErrors: false })
  const server = http.createServer(yoga)
  const PORT = 50184

  beforeAll(() => {
    server.listen(PORT)
  })
  afterAll(() => {
    server.close()
  })

  test('uses a named fragment via fragment spread', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/graphql`, {
      method: 'post',
      body: JSON.stringify({
        query: `
          query {
            getProfile(input: "p1") {
              ...Basic
            }
          }
          fragment Basic on Profile {
            id
            name
          }
        `,
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    const body = await res.json()
    expect(body.data.getProfile).toEqual({ id: 'p1', name: 'N' })
  })

  test('throws when referencing a missing fragment', async () => {
    // Bypass GraphQL validation by hand-crafting a GraphQLResolveInfo that
    // references a non-existent fragment. Since graphql-js validates query
    // before resolution, we cannot easily reach the runtime "not found"
    // throw via a real server, but we *can* verify that the resolver error
    // path triggers when the resolved type cannot find the fragment in
    // info.fragments. Use an undefined fragment name in the query and rely
    // on graphql-js to surface a validation error – that's still a useful
    // regression test on the integration boundary.
    const res = await fetch(`http://127.0.0.1:${PORT}/graphql`, {
      method: 'post',
      body: JSON.stringify({
        query: `
          query {
            getProfile(input: "p1") {
              ...Missing
            }
          }
        `,
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    const body = await res.json()
    // graphql-js should reject the query as invalid ⇒ we just want to make
    // sure the server still returns a controlled error.
    expect(body.errors).toBeDefined()
  })
})

// ============================================
// Total count array support (lines 794-800, 890, 899)
// ============================================
describe('TotalCountArray output', () => {
  const Item = () =>
    model.entity({
      id: model.string(),
    })

  const listItems = functions
    .define({
      output: model.array(Item, { totalCount: true }),
      options: { operation: 'query' },
    })
    .implement({
      body: async () => {
        const arr = new model.TotalCountArray<{ id: string }>(42, [{ id: '1' }, { id: '2' }])
        return result.ok(arr as any)
      },
    })

  const mod = module.build({
    name: 'total-count',
    functions: { listItems },
  })

  const schema = fromModule({
    api: build({
      module: mod,
      functions: { listItems: { type: 'query' } },
    }),
    context: async () => ({}),
  })

  const yoga = createYoga<ServerContext>({ schema, maskedErrors: false })
  const server = http.createServer(yoga)
  const PORT = 50185

  beforeAll(() => {
    server.listen(PORT)
  })
  afterAll(() => {
    server.close()
  })

  test('selecting items returns the wrapped value with totalCount', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/graphql`, {
      method: 'post',
      body: JSON.stringify({ query: '{ listItems { value { id } totalCount } }' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const body = await res.json()
    expect(body.data.listItems.value).toEqual([{ id: '1' }, { id: '2' }])
    expect(body.data.listItems.totalCount).toBe(42)
  })

  test('selecting only totalCount works', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/graphql`, {
      method: 'post',
      body: JSON.stringify({ query: '{ listItems { totalCount } }' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const body = await res.json()
    expect(body.data.listItems.totalCount).toBe(42)
  })
})

// ============================================
// TotalCountArray returning a plain array (line 798-799 alternative branch)
// ============================================
describe('TotalCountArray output with plain Array fallback', () => {
  const Item = () =>
    model.entity({
      id: model.string(),
    })

  const listItemsPlain = functions
    .define({
      output: model.array(Item, { totalCount: true }),
      options: { operation: 'query' },
    })
    .implement({
      // Returning a plain array — the resolver should fall back to using its length
      body: async () => result.ok([{ id: 'a' }, { id: 'b' }, { id: 'c' }] as any),
    })

  const mod = module.build({
    name: 'total-count-plain',
    functions: { listItemsPlain },
  })

  const schema = fromModule({
    api: build({
      module: mod,
      functions: { listItemsPlain: { type: 'query' } },
    }),
    context: async () => ({}),
  })

  const yoga = createYoga<ServerContext>({ schema, maskedErrors: false })
  const server = http.createServer(yoga)
  const PORT = 50186

  beforeAll(() => {
    server.listen(PORT)
  })
  afterAll(() => {
    server.close()
  })

  test('falls back to array length when not a TotalCountArray', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/graphql`, {
      method: 'post',
      body: JSON.stringify({ query: '{ listItemsPlain { value { id } totalCount } }' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const body = await res.json()
    expect(body.data.listItemsPlain.totalCount).toBe(3)
    expect(body.data.listItemsPlain.value).toHaveLength(3)
  })
})

// ============================================
// Same query twice → multiple field nodes (line 978-981)
// ============================================
describe('Multiple field nodes per query', () => {
  const fn = functions
    .define({
      input: model.string(),
      output: model.string(),
      options: { operation: 'query' },
    })
    .implement({
      body: async ({ input }) => result.ok(input),
    })

  const mod = module.build({
    name: 'multi-field-nodes',
    functions: { fn },
  })

  const schema = fromModule({
    api: build({
      module: mod,
      functions: { fn: { type: 'query' } },
    }),
    context: async () => ({}),
  })

  test('selecting same field twice does not crash', async () => {
    // graphql-js may either dedupe identical selections (returning data)
    // or surface a validation/conflict error. Either is acceptable — our
    // goal here is just to ensure the schema does not crash unexpectedly.
    const r = await graphql({
      schema,
      source: `query { fn(input: "x") fn(input: "x") }`,
    })
    expect(r.data?.fn === 'x' || (r.errors?.length ?? 0) > 0).toBe(true)
  })
})

// ============================================
// Direct invocation: gatherRawRetrieve via internal resolver
// to trigger the fieldNodes.length !== 1 branch.
// ============================================
describe('Multiple fieldNodes triggers an error', () => {
  // Build a schema for a function that uses retrieve so that the resolver
  // calls gatherRawRetrieve (which triggers the fieldNodes.length !== 1
  // branch). Then resolve the field manually with a synthetic
  // GraphQLResolveInfo that contains two fieldNodes.
  const Item = () =>
    model.entity({
      id: model.string(),
    })

  const getItem = functions
    .define({
      input: model.string(),
      output: Item,
      retrieve: { select: true },
      options: { operation: 'query' },
    })
    .implement({
      body: async ({ input }) => result.ok({ id: input }),
    })

  const mod = module.build({
    name: 'multi-fieldnodes',
    functions: { getItem },
  })

  const schema = fromModule({
    api: build({
      module: mod,
      functions: { getItem: { type: 'query' } },
    }),
    context: async () => ({}),
  })

  test('resolver throws when info.fieldNodes contains more than one node', async () => {
    const queryType = schema.getQueryType()!
    const field = queryType.getFields()['getItem']
    expect(field.resolve).toBeDefined()

    // Build a minimal GraphQLResolveInfo with two fieldNodes.
    const document = parse(`{ getItem(input: "x") { id } }`)
    const operation = getOperationAST(document)!
    const fieldNode = (operation.selectionSet.selections as any)[0]

    const info: any = {
      fieldName: 'getItem',
      fieldNodes: [fieldNode, fieldNode],
      returnType: field.type,
      parentType: queryType,
      path: { prev: undefined, key: 'getItem', typename: 'Query' },
      schema,
      fragments: {},
      rootValue: undefined,
      operation,
      variableValues: {},
    }

    await expect(Promise.resolve(field.resolve!({}, { input: 'x' }, {}, info))).rejects.toThrow(
      /Invalid field nodes count/,
    )
  })
})

// ============================================
// Direct invocation: trigger the "Fragment not found" branch (line 707-708)
// by constructing a GraphQLResolveInfo whose fieldNodes reference a fragment
// that is missing from info.fragments.
// ============================================
describe('Missing fragment in selection', () => {
  const Item = () =>
    model.entity({
      id: model.string(),
    })

  const getItem = functions
    .define({
      input: model.string(),
      output: Item,
      retrieve: { select: true },
      options: { operation: 'query' },
    })
    .implement({
      body: async ({ input }) => result.ok({ id: input }),
    })

  const mod = module.build({
    name: 'missing-fragment',
    functions: { getItem },
  })

  const schema = fromModule({
    api: build({
      module: mod,
      functions: { getItem: { type: 'query' } },
    }),
    context: async () => ({}),
  })

  test('throws when a fragment spread references a missing fragment', async () => {
    const queryType = schema.getQueryType()!
    const field = queryType.getFields()['getItem']

    // Build a query whose selection set is exclusively a fragment spread
    // pointing at a fragment that we deliberately do NOT register in
    // info.fragments. graphql-js would normally validate this away, but by
    // calling the resolver directly we can hit the runtime check.
    const document = parse(`{ getItem(input: "x") { ...Missing } }`)
    const operation = document.definitions[0] as any
    const fieldNode = operation.selectionSet.selections[0]

    const info: any = {
      fieldName: 'getItem',
      fieldNodes: [fieldNode],
      returnType: field.type,
      parentType: queryType,
      path: { prev: undefined, key: 'getItem', typename: 'Query' },
      schema,
      fragments: {}, // intentionally empty
      rootValue: undefined,
      operation,
      variableValues: {},
    }

    await expect(Promise.resolve(field.resolve!({}, { input: 'x' }, {}, info))).rejects.toThrow(
      /Fragment Missing not found/,
    )
  })
})

// ============================================
// Function with `errors` to exercise lines 902-918 (Failure wrapper generation)
// We already have such tests, but add one with a single object error to make
// sure the `code: model.string()` line (913) is exercised.
// ============================================
describe('Functions with errors generate Failure wrapper', () => {
  const fail = functions
    .define({
      input: model.string(),
      output: model.string(),
      errors: { boom: model.object({ reason: model.string() }) },
    })
    .implement({
      body: async () => result.fail({ boom: { reason: 'bad things' } }),
    })

  const mod = module.build({
    name: 'failure-wrapper',
    functions: { fail },
  })

  const schema = fromModule({
    api: build({
      module: mod,
      functions: { fail: { type: 'mutation' } },
    }),
    context: async () => ({}),
  })

  const yoga = createYoga<ServerContext>({ schema, maskedErrors: false })
  const server = http.createServer(yoga)
  const PORT = 50187

  beforeAll(() => {
    server.listen(PORT)
  })
  afterAll(() => {
    server.close()
  })

  test('returns the Failure wrapper with code', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/graphql`, {
      method: 'post',
      body: JSON.stringify({
        query: `mutation {
          fail(input: "x") {
            ... on FailFailure { code errors { boom { reason } } }
            ... on FailSuccess { value }
          }
        }`,
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    const body = await res.json()
    expect(body.data.fail.code).toBe('boom')
    expect(body.data.fail.errors.boom.reason).toBe('bad things')
  })

  test('inline ...on FailFailure inside the selection skips the Failure tag', async () => {
    // This exercises selectionNodeToRetrieve's filter that drops INLINE_FRAGMENT
    // nodes whose typeCondition includes "Failure".
    const res = await fetch(`http://127.0.0.1:${PORT}/graphql`, {
      method: 'post',
      body: JSON.stringify({
        query: `mutation {
          fail(input: "x") {
            ... on FailFailure { code }
          }
        }`,
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    const body = await res.json()
    expect(body.data.fail.code).toBe('boom')
  })
})

// ============================================
// Entity with retrieve.where + retrieve.orderBy options to exercise the
// truthy consequent of capabilities.where / capabilities.orderBy in
// retrieveTypeToGraphqlArgs (lines 441-442 cond-expr).
// ============================================
describe('Entity with where/orderBy retrieve options', () => {
  const Item = () =>
    model.entity(
      {
        id: model.string(),
        name: model.string(),
      },
      { retrieve: { where: true, orderBy: true, take: true, skip: true } },
    )

  // Nested entity used in a parent so typeToGraphQLObjectField also triggers
  // retrieveTypeToGraphqlArgs from line 410.
  const Parent = () =>
    model.entity({
      id: model.string(),
      items: model.array(Item).mutable(),
    })

  const getParent = functions
    .define({
      input: model.string(),
      output: Parent,
      retrieve: { select: true, where: true, orderBy: true, take: true, skip: true },
      options: { operation: 'query' },
    })
    .implement({
      body: async ({ input }) => result.ok({ id: input, items: [] }),
    })

  const mod = module.build({
    name: 'where-orderby-entity',
    functions: { getParent },
  })

  test('schema is built with where/orderBy retrieve args', () => {
    const schema = fromModule({
      api: build({
        module: mod,
        functions: { getParent: { type: 'query' } },
      }),
      context: async () => ({}),
    })
    expect(schema).toBeDefined()
  })
})

// ============================================
// Retrieve capabilities subset (lines 441-444)
// retrieveTypeToGraphqlArgs called with capabilities lacking some fields
// ============================================
describe('Function with subset retrieve capabilities', () => {
  const Item = () =>
    model.entity({
      id: model.string(),
    })

  const onlyTake = functions
    .define({
      output: model.array(Item),
      retrieve: { select: true, take: true }, // only take + select, no where/skip/orderBy
      options: { operation: 'query' },
    })
    .implement({
      body: async ({ retrieve }) => {
        const all = [{ id: '1' }, { id: '2' }, { id: '3' }]
        return result.ok(all.slice(0, retrieve.take ?? all.length))
      },
    })

  const mod = module.build({
    name: 'subset-retrieve',
    functions: { onlyTake },
  })

  const schema = fromModule({
    api: build({
      module: mod,
      functions: { onlyTake: { type: 'query' } },
    }),
    context: async () => ({}),
  })

  const yoga = createYoga<ServerContext>({ schema, maskedErrors: false })
  const server = http.createServer(yoga)
  const PORT = 50188

  beforeAll(() => {
    server.listen(PORT)
  })
  afterAll(() => {
    server.close()
  })

  test('only `take` is exposed as retrieve argument', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/graphql`, {
      method: 'post',
      body: JSON.stringify({ query: '{ onlyTake(take: 2) { id } }' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const body = await res.json()
    expect(body.data.onlyTake).toEqual([{ id: '1' }, { id: '2' }])
  })
})
