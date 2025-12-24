import { FileManager } from '../src/file-manager'
import { writeReport } from '../src/impl/write-report'
import { DEFAULT_PASSWORD, encrypt, sha256 } from '../src/utils'
import { describe, expect, it, vi, beforeEach } from 'vitest'

describe('write-report', () => {
  const mockFileManager: FileManager = {
    type: 'local',
    read: vi.fn(),
    write: vi.fn(),
  }

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should write encrypted report with default password when no password provided', async () => {
    const content = '<html>Report Content</html>'
    const reportId = 'test-report-id'

    await writeReport({
      fileManager: mockFileManager,
      password: undefined,
      content,
      reportId,
    })

    expect(mockFileManager.write).toHaveBeenCalledTimes(1)
    const [filename, writtenContent] = (mockFileManager.write as ReturnType<typeof vi.fn>).mock.calls[0]

    expect(filename).toBe(`/tmp/${reportId}.json`)

    const parsed = JSON.parse(writtenContent)
    expect(parsed.secretHash).toBe(sha256(DEFAULT_PASSWORD))
    expect(parsed.content).toBeDefined()
    // The content should be encrypted, not plain
    expect(parsed.content).not.toBe(content)
  })

  it('should write encrypted report with custom password', async () => {
    const content = '<html>Report Content</html>'
    const reportId = 'test-report-id'
    const password = 'customPassword123'

    await writeReport({
      fileManager: mockFileManager,
      password,
      content,
      reportId,
    })

    expect(mockFileManager.write).toHaveBeenCalledTimes(1)
    const [filename, writtenContent] = (mockFileManager.write as ReturnType<typeof vi.fn>).mock.calls[0]

    expect(filename).toBe(`/tmp/${reportId}.json`)

    const parsed = JSON.parse(writtenContent)
    expect(parsed.secretHash).toBe(sha256(password))
    expect(parsed.content).toBeDefined()
  })

  it('should use s3 path format for s3 file manager', async () => {
    const s3FileManager: FileManager = {
      type: 's3',
      read: vi.fn(),
      write: vi.fn(),
    }

    const content = '<html>Report Content</html>'
    const reportId = 'test-report-id'

    await writeReport({
      fileManager: s3FileManager,
      password: 'test',
      content,
      reportId,
    })

    expect(s3FileManager.write).toHaveBeenCalledTimes(1)
    const [filename] = (s3FileManager.write as ReturnType<typeof vi.fn>).mock.calls[0]

    expect(filename).toBe(`${reportId}.json`)
  })

  it('should handle empty content', async () => {
    const content = ''
    const reportId = 'empty-report'

    await writeReport({
      fileManager: mockFileManager,
      password: undefined,
      content,
      reportId,
    })

    expect(mockFileManager.write).toHaveBeenCalledTimes(1)
  })

  it('should handle special characters in content', async () => {
    const content = '<html>Special chars: "quotes" \'apostrophes\' & ampersands</html>'
    const reportId = 'special-chars'

    await writeReport({
      fileManager: mockFileManager,
      password: undefined,
      content,
      reportId,
    })

    expect(mockFileManager.write).toHaveBeenCalledTimes(1)
    const [, writtenContent] = (mockFileManager.write as ReturnType<typeof vi.fn>).mock.calls[0]

    // Verify the JSON is valid
    expect(() => JSON.parse(writtenContent)).not.toThrow()
  })
})
