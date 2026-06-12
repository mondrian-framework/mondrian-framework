import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      // Force the CommonJS build of graphql for code processed by vite, so it shares
      // the same module instance as packages loaded natively by node (graphql-yoga,
      // @graphql-tools/*). Otherwise graphql is loaded twice (index.mjs + index.js)
      // and graphql-js throws "Cannot use GraphQLSchema from another module or realm".
      graphql: 'graphql/index.js',
    },
  },
  test: {
    testTimeout: 10000,
    typecheck: {
      enabled: true,
      checker: 'tsc',
      tsconfig: './tsconfig.typecheck.json',
    },
    coverage: {
      exclude: ['packages/docs/**'],
      include: ['packages/*/src/**'],
    },
  },
})
