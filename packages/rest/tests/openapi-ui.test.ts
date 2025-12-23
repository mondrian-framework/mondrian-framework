import { ui } from '../src/openapi-ui'
import { model } from '@mondrian-framework/model'
import { functions, module } from '@mondrian-framework/module'
import { describe, expect, test } from 'vitest'

describe('openapi-ui', () => {
  const testModule = module.define({
    name: 'TestAPI',
    functions: {
      testFn: functions.define({
        input: model.string(),
        output: model.string(),
      }),
    },
  })

  const api = {
    version: 1,
    module: testModule,
    functions: { testFn: { method: 'get' as const } },
  }

  describe('ui', () => {
    test('returns empty body when introspection is false', () => {
      const html = ui({
        api,
        options: { introspection: false },
      })

      expect(html).toContain('<!doctype html>')
      expect(html).toContain('<title>TestAPI API Reference</title>')
      expect(html).not.toContain('swagger-ui')
      expect(html).not.toContain('scalar')
      expect(html).not.toContain('redoc')
    })

    test('returns swagger UI when ui is swagger', () => {
      const html = ui({
        api,
        options: { introspection: { path: '/docs', ui: 'swagger' } },
      })

      expect(html).toContain('<!doctype html>')
      expect(html).toContain('<title>TestAPI API Reference</title>')
      expect(html).toContain('swagger-ui')
      expect(html).toContain('swagger-ui-bundle.js')
      expect(html).toContain('/docs/v1/schema.json')
    })

    test('returns scalar UI when ui is scalar', () => {
      const html = ui({
        api,
        options: { introspection: { path: '/docs', ui: 'scalar' } },
      })

      expect(html).toContain('<!doctype html>')
      expect(html).toContain('<title>TestAPI API Reference</title>')
      expect(html).toContain('api-reference')
      expect(html).toContain('@scalar/api-reference')
      expect(html).toContain('/docs/v1/schema.json')
    })

    test('returns redoc UI when ui is redoc', () => {
      const html = ui({
        api,
        options: { introspection: { path: '/docs', ui: 'redoc' } },
      })

      expect(html).toContain('<!doctype html>')
      expect(html).toContain('<title>TestAPI API Reference</title>')
      expect(html).toContain('<redoc')
      expect(html).toContain('redoc.standalone.js')
      expect(html).toContain('/docs/v1/schema.json')
    })

    test('handles path with trailing slash', () => {
      const html = ui({
        api,
        options: { introspection: { path: '/docs/', ui: 'swagger' } },
      })

      expect(html).toContain('/docs/v1/schema.json')
    })

    test('handles path without trailing slash', () => {
      const html = ui({
        api,
        options: { introspection: { path: '/api/docs', ui: 'swagger' } },
      })

      expect(html).toContain('/api/docs/v1/schema.json')
    })

    test('uses api version in schema path', () => {
      const versionedApi = {
        ...api,
        version: 3,
      }

      const html = ui({
        api: versionedApi,
        options: { introspection: { path: '/docs', ui: 'swagger' } },
      })

      expect(html).toContain('/docs/v3/schema.json')
    })

    test('returns none ui when ui is none', () => {
      const html = ui({
        api,
        options: { introspection: { path: '/docs', ui: 'none' } },
      })

      expect(html).toContain('<!doctype html>')
      expect(html).toContain('<title>TestAPI API Reference</title>')
      expect(html).not.toContain('swagger-ui')
      expect(html).not.toContain('scalar')
      expect(html).not.toContain('redoc')
    })

    test('includes correct meta tags', () => {
      const html = ui({
        api,
        options: { introspection: { path: '/docs', ui: 'swagger' } },
      })

      expect(html).toContain('<meta charset="utf-8" />')
      expect(html).toContain('name="viewport"')
      expect(html).toContain('name="description"')
      expect(html).toContain('TestAPI API Reference')
    })

    test('includes favicon', () => {
      const html = ui({
        api,
        options: { introspection: { path: '/docs', ui: 'swagger' } },
      })

      expect(html).toContain('rel="icon"')
      expect(html).toContain('openapi-original.svg')
    })
  })
})
