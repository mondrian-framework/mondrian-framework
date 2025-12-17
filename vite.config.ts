import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    testTimeout: 10000,
    coverage: {
      exclude: ['packages/example/**', 'packages/docs/**'],
      include: ['packages/*/src/**'],
    },
  },
})
