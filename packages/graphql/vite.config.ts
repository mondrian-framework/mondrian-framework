import { defineConfig } from 'vitest/config'

// We _must_ do this to avoid problems with GraphQL. Otherwise running the tests
// would result in a runtime error as soon as we try to use any function coming
// from the graphql module
export default defineConfig({
  test: {
    deps: {
      fallbackCJS: true,
    },
  },
})
