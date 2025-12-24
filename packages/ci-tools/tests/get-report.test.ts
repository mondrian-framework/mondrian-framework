import { FileManager } from '../src/file-manager'
import { module } from '../src/impl/module'
import { DEFAULT_PASSWORD, decrypt, sha256 } from '../src/utils'
import { client as clientBuilder } from '@mondrian-framework/module'
import { buildSchema } from 'graphql'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

describe('get-report', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    process.env.SERVER_BASE_URL = 'http://localhost:4000'
    delete process.env.BUCKET
  })

  afterEach(() => {
    process.env = originalEnv
  })

  const client = clientBuilder.build({
    module: module,
    async context() {
      return {}
    },
  })

  it('should return reportNotFound for non-existent report', async () => {
    const result = await client.functions.getReport({
      reportId: '00000000-0000-0000-0000-000000000000',
    })

    expect(result.isFailure).toBe(true)
    if (result.isFailure) {
      expect(result.error).toEqual({ reportNotFound: '00000000-0000-0000-0000-000000000000' })
    }
  })

  it('should return reportNotFound with wrong password', async () => {
    // First create a report
    const reportG = await client.functions.buildGraphQLReport({
      previousSchema: buildSchema(`type Query { test: String }`),
      currentSchema: buildSchema(`type Query { test: String }`),
      password: 'correctPassword',
    })

    expect(reportG.isOk).toBe(true)
    if (reportG.isOk) {
      // Try to get it with wrong password
      const result = await client.functions.getReport({
        reportId: reportG.value.reportId,
        password: 'wrongPassword',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error).toEqual({ reportNotFound: reportG.value.reportId })
      }
    }
  })

  it('should retrieve report with correct password', async () => {
    const password = 'testPassword123'

    const reportG = await client.functions.buildGraphQLReport({
      previousSchema: buildSchema(`type Query { test: String }`),
      currentSchema: buildSchema(`type Query { test: String }`),
      password,
    })

    expect(reportG.isOk).toBe(true)
    if (reportG.isOk) {
      const result = await client.functions.getReport({
        reportId: reportG.value.reportId,
        password,
      })

      expect(result.isOk).toBe(true)
      if (result.isOk) {
        expect(result.value).toContain('<!DOCTYPE html>')
      }
    }
  })

  it('should retrieve report with default password when none provided', async () => {
    // Create report without password (uses default)
    const reportG = await client.functions.buildGraphQLReport({
      previousSchema: buildSchema(`type Query { test: String }`),
      currentSchema: buildSchema(`type Query { test: String }`),
    })

    expect(reportG.isOk).toBe(true)
    if (reportG.isOk) {
      // Get report without password (uses default)
      const result = await client.functions.getReport({
        reportId: reportG.value.reportId,
      })

      expect(result.isOk).toBe(true)
    }
  })

  it('should fail when no password provided but report was created with password', async () => {
    const reportG = await client.functions.buildGraphQLReport({
      previousSchema: buildSchema(`type Query { test: String }`),
      currentSchema: buildSchema(`type Query { test: String }`),
      password: 'customPassword',
    })

    expect(reportG.isOk).toBe(true)
    if (reportG.isOk) {
      // Get report without password (uses default, should fail)
      const result = await client.functions.getReport({
        reportId: reportG.value.reportId,
      })

      expect(result.isFailure).toBe(true)
    }
  })
})
