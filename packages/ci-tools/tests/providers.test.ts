import { LOCAL_FILE_MANAGER, S3_FILE_MANAGER } from '../src/file-manager'
import { contextProvider } from '../src/impl/providers'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

describe('providers', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('contextProvider', () => {
    it('should return LOCAL_FILE_MANAGER when BUCKET is not set', async () => {
      delete process.env.BUCKET
      process.env.SERVER_BASE_URL = 'http://localhost:3000'

      const result = await contextProvider.body({}, {} as any)

      expect(result.isOk).toBe(true)
      if (result.isOk) {
        expect(result.value.fileManager).toBe(LOCAL_FILE_MANAGER)
        expect(result.value.serverBaseURL).toBe('http://localhost:3000')
      }
    })

    it('should return S3_FILE_MANAGER when BUCKET is set', async () => {
      process.env.BUCKET = 'my-bucket'
      process.env.SERVER_BASE_URL = 'https://api.example.com'

      const result = await contextProvider.body({}, {} as any)

      expect(result.isOk).toBe(true)
      if (result.isOk) {
        expect(result.value.fileManager).toBe(S3_FILE_MANAGER)
        expect(result.value.serverBaseURL).toBe('https://api.example.com')
      }
    })

    it('should return undefined serverBaseURL when not set', async () => {
      delete process.env.BUCKET
      delete process.env.SERVER_BASE_URL

      const result = await contextProvider.body({}, {} as any)

      expect(result.isOk).toBe(true)
      if (result.isOk) {
        expect(result.value.serverBaseURL).toBeUndefined()
      }
    })
  })
})
