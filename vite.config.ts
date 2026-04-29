import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    testTimeout: 10000,
    coverage: {
      exclude: ['packages/docs/**'],
      include: ['packages/*/src/**'],
    },
  },
})
