import { logger } from '../src'
import { logs, LogRecord, SeverityNumber, Logger, LogAttributes } from '@opentelemetry/api-logs'
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'

describe('MondrianLogger', () => {
  let mockLogger: Logger
  let emittedRecords: LogRecord[]

  beforeEach(() => {
    emittedRecords = []
    mockLogger = {
      emit: vi.fn((record: LogRecord) => {
        emittedRecords.push(record)
      }),
    }
    // Mock the logs.getLogger
    vi.spyOn(logs, 'getLogger').mockReturnValue(mockLogger)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('build', () => {
    test('should create a MondrianLogger with context', () => {
      const mondrianLogger = logger.build({ moduleName: 'testModule' })
      expect(mondrianLogger).toBeDefined()
    })

    test('should create a MondrianLogger with full context', () => {
      const mondrianLogger = logger.build({
        moduleName: 'testModule',
        operationType: 'QUERY',
        operationName: 'getUser',
        server: 'GRAPHQL',
      })
      expect(mondrianLogger).toBeDefined()
    })
  })

  describe('emit', () => {
    test('should emit log record with context attributes', () => {
      const mondrianLogger = logger.build({ moduleName: 'testModule' })
      mondrianLogger.emit({ body: 'test message' })

      expect(mockLogger.emit).toHaveBeenCalledTimes(1)
      expect(emittedRecords[0].body).toBe('test message')
      expect(emittedRecords[0].attributes?.moduleName).toBe('testModule')
    })

    test('should merge log attributes with context', () => {
      const mondrianLogger = logger.build({ moduleName: 'testModule' })
      mondrianLogger.emit({
        body: 'test message',
        attributes: { customAttr: 'value' },
      })

      expect(emittedRecords[0].attributes?.moduleName).toBe('testModule')
      expect(emittedRecords[0].attributes?.customAttr).toBe('value')
    })
  })

  describe('logDebug', () => {
    test('should emit debug log with correct severity', () => {
      const mondrianLogger = logger.build({ moduleName: 'testModule' })
      mondrianLogger.logDebug('Debug message')

      expect(emittedRecords[0].body).toBe('Debug message')
      expect(emittedRecords[0].severityNumber).toBe(SeverityNumber.DEBUG)
      expect(emittedRecords[0].severityText).toBe('DEBUG')
    })

    test('should emit debug log with attributes', () => {
      const mondrianLogger = logger.build({ moduleName: 'testModule' })
      mondrianLogger.logDebug('Debug message', { key: 'value' })

      expect(emittedRecords[0].attributes?.key).toBe('value')
    })
  })

  describe('logInfo', () => {
    test('should emit info log with correct severity', () => {
      const mondrianLogger = logger.build({ moduleName: 'testModule' })
      mondrianLogger.logInfo('Info message')

      expect(emittedRecords[0].body).toBe('Info message')
      expect(emittedRecords[0].severityNumber).toBe(SeverityNumber.INFO)
      expect(emittedRecords[0].severityText).toBe('INFO')
    })

    test('should emit info log with attributes', () => {
      const mondrianLogger = logger.build({ moduleName: 'testModule' })
      mondrianLogger.logInfo('Info message', { userId: 123 })

      expect(emittedRecords[0].attributes?.userId).toBe(123)
    })
  })

  describe('logWarn', () => {
    test('should emit warn log with correct severity', () => {
      const mondrianLogger = logger.build({ moduleName: 'testModule' })
      mondrianLogger.logWarn('Warning message')

      expect(emittedRecords[0].body).toBe('Warning message')
      expect(emittedRecords[0].severityNumber).toBe(SeverityNumber.WARN)
      expect(emittedRecords[0].severityText).toBe('WARN')
    })
  })

  describe('logError', () => {
    test('should emit error log with correct severity', () => {
      const mondrianLogger = logger.build({ moduleName: 'testModule' })
      mondrianLogger.logError('Error message')

      expect(emittedRecords[0].body).toBe('Error message')
      expect(emittedRecords[0].severityNumber).toBe(SeverityNumber.ERROR)
      expect(emittedRecords[0].severityText).toBe('ERROR')
    })

    test('should emit error log with error attributes', () => {
      const mondrianLogger = logger.build({ moduleName: 'testModule' })
      mondrianLogger.logError('Error message', { errorCode: 'E001', stack: 'stack trace' })

      expect(emittedRecords[0].attributes?.errorCode).toBe('E001')
      expect(emittedRecords[0].attributes?.stack).toBe('stack trace')
    })
  })

  describe('logFatal', () => {
    test('should emit fatal log with correct severity', () => {
      const mondrianLogger = logger.build({ moduleName: 'testModule' })
      mondrianLogger.logFatal('Fatal message')

      expect(emittedRecords[0].body).toBe('Fatal message')
      expect(emittedRecords[0].severityNumber).toBe(SeverityNumber.FATAL)
      expect(emittedRecords[0].severityText).toBe('FATAL')
    })
  })

  describe('updateContext', () => {
    test('should create new logger with updated context', () => {
      const mondrianLogger = logger.build({ moduleName: 'testModule' })
      const updatedLogger = mondrianLogger.updateContext({ operationName: 'getUsers' })

      updatedLogger.logInfo('Test message')

      expect(emittedRecords[0].attributes?.moduleName).toBe('testModule')
      expect(emittedRecords[0].attributes?.operationName).toBe('getUsers')
    })

    test('should override existing context properties', () => {
      const mondrianLogger = logger.build({ moduleName: 'testModule', server: 'REST' })
      const updatedLogger = mondrianLogger.updateContext({ server: 'GRAPHQL' })

      updatedLogger.logInfo('Test message')

      expect(emittedRecords[0].attributes?.server).toBe('GRAPHQL')
    })

    test('should not affect original logger', () => {
      const mondrianLogger = logger.build({ moduleName: 'testModule' })
      mondrianLogger.updateContext({ operationName: 'getUsers' })

      mondrianLogger.logInfo('Original logger message')

      expect(emittedRecords[0].attributes?.operationName).toBeUndefined()
    })

    test('should chain multiple context updates', () => {
      const mondrianLogger = logger.build({ moduleName: 'testModule' })
      const updatedLogger = mondrianLogger
        .updateContext({ operationType: 'QUERY' })
        .updateContext({ operationName: 'getUser' })
        .updateContext({ server: 'GRAPHQL' })

      updatedLogger.logInfo('Chained context')

      expect(emittedRecords[0].attributes?.moduleName).toBe('testModule')
      expect(emittedRecords[0].attributes?.operationType).toBe('QUERY')
      expect(emittedRecords[0].attributes?.operationName).toBe('getUser')
      expect(emittedRecords[0].attributes?.server).toBe('GRAPHQL')
    })
  })
})
