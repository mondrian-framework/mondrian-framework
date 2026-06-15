import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      // Force the CommonJS build of graphql for code processed by vite, so it shares
      // the same module instance as packages loaded natively by node (graphql-yoga,
      // @graphql-tools/*). Otherwise graphql is loaded twice (index.mjs + index.js)
      // and graphql-js throws "Cannot use GraphQLSchema from another module or realm".
      // The root vite.config.ts has the same alias for the root-level `vitest run`;
      // this is needed for the per-package `npm test` (vitest run inside this package).
      graphql: 'graphql/index.js',
    },
  },
})
