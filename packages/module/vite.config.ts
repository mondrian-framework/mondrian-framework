import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // The opentelemetry test flushes an OTLP exporter against a dead endpoint on
    // provider.shutdown(), which takes ~9s; the 5000ms default times out. The root
    // vite.config.ts raises this for the root-level `vitest run`; this is needed for
    // the per-package `npm test` (vitest run inside this package).
    testTimeout: 15000,
  },
})
