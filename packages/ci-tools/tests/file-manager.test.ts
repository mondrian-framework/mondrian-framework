import { FileManager, LOCAL_FILE_MANAGER, S3_FILE_MANAGER } from '../src/file-manager'
import * as fs from 'fs'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

vi.mock('fs')

describe('file-manager', () => {
  describe('LOCAL_FILE_MANAGER', () => {
    beforeEach(() => {
      vi.resetAllMocks()
    })

    it('should have type "local"', () => {
      expect(LOCAL_FILE_MANAGER.type).toBe('local')
    })

    describe('read', () => {
      it('should read file content successfully', async () => {
        const mockContent = 'file content'
        vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from(mockContent))

        const result = await LOCAL_FILE_MANAGER.read('/tmp/test.txt')

        expect(fs.readFileSync).toHaveBeenCalledWith('/tmp/test.txt')
        expect(result).toBe(mockContent)
      })

      it('should return null when file does not exist', async () => {
        vi.mocked(fs.readFileSync).mockImplementation(() => {
          throw new Error('ENOENT: no such file')
        })

        const result = await LOCAL_FILE_MANAGER.read('/tmp/nonexistent.txt')

        expect(result).toBe(null)
      })

      it('should return null on any read error', async () => {
        vi.mocked(fs.readFileSync).mockImplementation(() => {
          throw new Error('Permission denied')
        })

        const result = await LOCAL_FILE_MANAGER.read('/tmp/restricted.txt')

        expect(result).toBe(null)
      })
    })

    describe('write', () => {
      it('should write content to file', async () => {
        vi.mocked(fs.writeFileSync).mockImplementation(() => {})

        await LOCAL_FILE_MANAGER.write('/tmp/output.txt', 'content to write')

        expect(fs.writeFileSync).toHaveBeenCalledWith('/tmp/output.txt', 'content to write')
      })
    })
  })

  describe('S3_FILE_MANAGER', () => {
    it('should have type "s3"', () => {
      expect(S3_FILE_MANAGER.type).toBe('s3')
    })

    describe('read', () => {
      it('should return null when S3 read fails', async () => {
        // Without AWS credentials, this should fail gracefully
        const result = await S3_FILE_MANAGER.read('test-key')
        expect(result).toBe(null)
      })
    })
  })

  describe('FileManager interface', () => {
    it('LOCAL_FILE_MANAGER should implement FileManager interface', () => {
      const fm: FileManager = LOCAL_FILE_MANAGER
      expect(fm.type).toBeDefined()
      expect(typeof fm.read).toBe('function')
      expect(typeof fm.write).toBe('function')
    })

    it('S3_FILE_MANAGER should implement FileManager interface', () => {
      const fm: FileManager = S3_FILE_MANAGER
      expect(fm.type).toBeDefined()
      expect(typeof fm.read).toBe('function')
      expect(typeof fm.write).toBe('function')
    })
  })
})
