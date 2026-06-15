import { sqs, listen } from '../src'
import * as AWS from '@aws-sdk/client-sqs'
import { model, result } from '@mondrian-framework/model'
import { functions, module, exception } from '@mondrian-framework/module'
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'

// =============================================================================
// Mock AWS SDK with controllable behavior
// =============================================================================

let receiveMessageImpl: (...args: any[]) => Promise<any> = () =>
  new Promise((resolve) => setTimeout(() => resolve({ Messages: [] }), 100000))
let deleteMessageImpl: (...args: any[]) => Promise<any> = () => Promise.resolve({})

const mockReceiveMessage = vi.fn((...args: any[]) => receiveMessageImpl(...args))
const mockDeleteMessage = vi.fn((...args: any[]) => deleteMessageImpl(...args))

vi.mock('@aws-sdk/client-sqs', async () => {
  const actual = await vi.importActual('@aws-sdk/client-sqs')
  return {
    ...actual,
    SQS: class MockSQS {
      constructor(public config?: any) {}
      receiveMessage(...args: any[]) {
        return mockReceiveMessage(...args)
      }
      deleteMessage(...args: any[]) {
        return mockDeleteMessage(...args)
      }
    },
  }
})

// =============================================================================
// Test Functions Setup
// =============================================================================

const processMessageFunction = functions
  .define({
    input: model.object({ message: model.string() }),
    output: model.string(),
  })
  .implement({
    async body({ input }) {
      return result.ok(`Processed: ${input.message}`)
    },
  })

const numberFunction = functions
  .define({
    input: model.number(),
    output: model.number(),
  })
  .implement({
    async body({ input }) {
      return result.ok(input * 2)
    },
  })

const throwingFunction = functions
  .define({
    input: model.string(),
    output: model.string(),
  })
  .implement({
    async body({ input }) {
      if (input === 'throw') {
        throw new Error('Intentional error')
      }
      return result.ok(input)
    },
  })

const noInputFunction = functions
  .define({
    output: model.string(),
  })
  .implement({
    async body() {
      return result.ok('no input needed')
    },
  })

const optionalInputFunction = functions
  .define({
    input: model.optional(model.string()),
    output: model.string(),
  })
  .implement({
    async body({ input }) {
      return result.ok(input ?? 'default')
    },
  })

// =============================================================================
// Test Module Setup
// =============================================================================

const testModule = module.build({
  name: 'test-sqs-module',
  functions: {
    processMessage: processMessageFunction,
    numberProcessor: numberFunction,
    throwingProcessor: throwingFunction,
    noInput: noInputFunction,
    optionalInput: optionalInputFunction,
  },
})

const testModuleInterface = module.define({
  name: 'test-sqs-interface',
  functions: {
    processMessage: functions.define({
      input: model.object({ message: model.string() }),
      output: model.string(),
    }),
    numberProcessor: functions.define({
      input: model.number(),
      output: model.number(),
    }),
  },
})

// =============================================================================
// Tests for sqs.build
// =============================================================================

describe('sqs.build', () => {
  describe('basic API building', () => {
    test('should create a valid SQS API with proper configuration', () => {
      const api = sqs.build({
        module: testModule,
        functions: {
          processMessage: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue' },
          numberProcessor: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/number-queue' },
          throwingProcessor: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/throw-queue' },
          noInput: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/no-input-queue' },
          optionalInput: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/optional-queue' },
        },
      })

      expect(api).toBeDefined()
      expect(api.module).toBe(testModule)
      expect(api.functions.processMessage?.queueUrl).toBe('https://sqs.us-east-1.amazonaws.com/123456789012/test-queue')
    })

    test('should accept API with options including config', () => {
      const api = sqs.build({
        module: testModule,
        functions: {
          processMessage: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue' },
          numberProcessor: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/number-queue' },
          throwingProcessor: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/throw-queue' },
          noInput: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/no-input-queue' },
          optionalInput: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/optional-queue' },
        },
        options: {
          config: { region: 'us-west-2' },
          maxConcurrency: 5,
        },
      })

      expect(api.options?.config?.region).toBe('us-west-2')
      expect(api.options?.maxConcurrency).toBe(5)
    })

    test('should accept function specifications with malformedMessagePolicy', () => {
      const api = sqs.build({
        module: testModule,
        functions: {
          processMessage: {
            queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue',
            malformedMessagePolicy: 'ignore',
          },
          numberProcessor: {
            queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/number-queue',
            malformedMessagePolicy: 'delete',
          },
          throwingProcessor: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/throw-queue' },
          noInput: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/no-input-queue' },
          optionalInput: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/optional-queue' },
        },
      })

      expect(api.functions.processMessage?.malformedMessagePolicy).toBe('ignore')
      expect(api.functions.numberProcessor?.malformedMessagePolicy).toBe('delete')
    })

    test('should accept function specifications with maxConcurrency', () => {
      const api = sqs.build({
        module: testModule,
        functions: {
          processMessage: {
            queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue',
            maxConcurrency: 10,
          },
          numberProcessor: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/number-queue' },
          throwingProcessor: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/throw-queue' },
          noInput: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/no-input-queue' },
          optionalInput: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/optional-queue' },
        },
      })

      expect(api.functions.processMessage?.maxConcurrency).toBe(10)
    })
  })

  describe('validation errors', () => {
    test('should throw error when function is missing queueUrl', () => {
      expect(() =>
        sqs.build({
          module: testModule,
          functions: {
            processMessage: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue' },
            // numberProcessor is missing queueUrl but is defined in module
          } as any,
        }),
      ).toThrow('Missing queueUrl for function numberProcessor')
    })

    test('should throw error when function spec exists but queueUrl is empty', () => {
      expect(() =>
        sqs.build({
          module: testModule,
          functions: {
            processMessage: { queueUrl: '' },
            numberProcessor: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/number-queue' },
            throwingProcessor: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/throw-queue' },
            noInput: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/no-input-queue' },
            optionalInput: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/optional-queue' },
          },
        }),
      ).toThrow('Missing queueUrl for function processMessage')
    })
  })
})

// =============================================================================
// Tests for sqs.define
// =============================================================================

describe('sqs.define', () => {
  describe('basic API definition', () => {
    test('should define a valid SQS API specification with interface', () => {
      const apiSpec = sqs.define({
        module: testModuleInterface,
        functions: {
          processMessage: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue' },
          numberProcessor: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/number-queue' },
        },
      })

      expect(apiSpec).toBeDefined()
      expect(apiSpec.module).toBe(testModuleInterface)
      expect(apiSpec.functions.processMessage?.queueUrl).toBe(
        'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue',
      )
    })

    test('should accept options in API specification', () => {
      const apiSpec = sqs.define({
        module: testModuleInterface,
        functions: {
          processMessage: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue' },
          numberProcessor: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/number-queue' },
        },
        options: {
          config: { region: 'eu-west-1' },
          maxConcurrency: 3,
        },
      })

      expect(apiSpec.options?.config?.region).toBe('eu-west-1')
      expect(apiSpec.options?.maxConcurrency).toBe(3)
    })
  })

  describe('validation errors', () => {
    test('should throw error when function is missing queueUrl in define', () => {
      expect(() =>
        sqs.define({
          module: testModuleInterface,
          functions: {
            processMessage: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue' },
            // numberProcessor is missing
          } as any,
        }),
      ).toThrow('Missing queueUrl for function numberProcessor')
    })
  })
})

// =============================================================================
// Tests for listen function
// =============================================================================

describe('listen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockReceiveMessage.mockClear()
    mockDeleteMessage.mockClear()
    // Reset to default implementations
    receiveMessageImpl = () => new Promise((resolve) => setTimeout(() => resolve({ Messages: [] }), 100000))
    deleteMessageImpl = () => Promise.resolve({})
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('listener setup', () => {
    test('should create a listener with close function', () => {
      const api = sqs.build({
        module: testModule,
        functions: {
          processMessage: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue' },
          numberProcessor: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/number-queue' },
          throwingProcessor: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/throw-queue' },
          noInput: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/no-input-queue' },
          optionalInput: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/optional-queue' },
        },
      })

      const listener = listen({
        api,
        context: async () => ({}),
        onError: () => {},
      })

      expect(listener).toBeDefined()
      expect(typeof listener.close).toBe('function')

      // Clean up
      listener.close()
    })

    test('should throw error for invalid concurrency (zero)', () => {
      const api = sqs.build({
        module: testModule,
        functions: {
          processMessage: {
            queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue',
            maxConcurrency: 0,
          },
          numberProcessor: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/number-queue' },
          throwingProcessor: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/throw-queue' },
          noInput: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/no-input-queue' },
          optionalInput: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/optional-queue' },
        },
      })

      expect(() =>
        listen({
          api,
          context: async () => ({}),
          onError: () => {},
        }),
      ).toThrow('Concurrency must be a positive integer')
    })

    test('should throw error for invalid concurrency (negative)', () => {
      const api = sqs.build({
        module: testModule,
        functions: {
          processMessage: {
            queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue',
            maxConcurrency: -1,
          },
          numberProcessor: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/number-queue' },
          throwingProcessor: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/throw-queue' },
          noInput: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/no-input-queue' },
          optionalInput: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/optional-queue' },
        },
      })

      expect(() =>
        listen({
          api,
          context: async () => ({}),
          onError: () => {},
        }),
      ).toThrow('Concurrency must be a positive integer')
    })

    test('should throw error for non-integer concurrency', () => {
      const api = sqs.build({
        module: testModule,
        functions: {
          processMessage: {
            queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue',
            maxConcurrency: 1.5,
          },
          numberProcessor: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/number-queue' },
          throwingProcessor: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/throw-queue' },
          noInput: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/no-input-queue' },
          optionalInput: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/optional-queue' },
        },
      })

      expect(() =>
        listen({
          api,
          context: async () => ({}),
          onError: () => {},
        }),
      ).toThrow('Concurrency must be a positive integer')
    })

    test('should use global maxConcurrency from options', () => {
      const api = sqs.build({
        module: testModule,
        functions: {
          processMessage: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue' },
          numberProcessor: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/number-queue' },
          throwingProcessor: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/throw-queue' },
          noInput: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/no-input-queue' },
          optionalInput: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/optional-queue' },
        },
        options: {
          maxConcurrency: 5,
        },
      })

      const listener = listen({
        api,
        context: async () => ({}),
        onError: () => {},
      })

      expect(listener).toBeDefined()
      listener.close()
    })
  })

  describe('message processing', () => {
    test('should process a valid message and delete it', async () => {
      const processed = new Promise<void>((resolve) => {
        let callCount = 0
        receiveMessageImpl = () => {
          callCount++
          if (callCount === 1) {
            return Promise.resolve({
              Messages: [
                {
                  MessageId: 'msg-123',
                  Body: JSON.stringify({ message: 'hello' }),
                  ReceiptHandle: 'receipt-123',
                },
              ],
            })
          }
          return new Promise(() => {}) // Never resolves for subsequent calls
        }
        deleteMessageImpl = () => {
          resolve()
          return Promise.resolve({})
        }
      })

      const singleFunctionModule = module.build({
        name: 'single-function-module',
        functions: {
          processMessage: processMessageFunction,
        },
      })

      const api = sqs.build({
        module: singleFunctionModule,
        functions: {
          processMessage: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue' },
        },
      })

      const listener = listen({
        api,
        context: async () => ({}),
        onError: () => {},
      })

      await processed

      expect(mockDeleteMessage).toHaveBeenCalledWith({
        QueueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue',
        ReceiptHandle: 'receipt-123',
      })

      listener.close()
    }, 10000)

    test('should call onError for invalid JSON and delete message by default', async () => {
      const onErrorMock = vi.fn()

      const processed = new Promise<void>((resolve) => {
        let callCount = 0
        receiveMessageImpl = () => {
          callCount++
          if (callCount === 1) {
            return Promise.resolve({
              Messages: [
                {
                  MessageId: 'msg-123',
                  Body: 'not valid json {{{',
                  ReceiptHandle: 'receipt-123',
                },
              ],
            })
          }
          return new Promise(() => {})
        }
        deleteMessageImpl = () => {
          resolve()
          return Promise.resolve({})
        }
      })

      const singleFunctionModule = module.build({
        name: 'single-function-module',
        functions: {
          processMessage: processMessageFunction,
        },
      })

      const api = sqs.build({
        module: singleFunctionModule,
        functions: {
          processMessage: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue' },
        },
      })

      const listener = listen({
        api,
        context: async () => ({}),
        onError: onErrorMock,
      })

      await processed

      expect(onErrorMock).toHaveBeenCalledWith(
        expect.objectContaining({
          errorKind: 'invalid-input',
          functionName: 'processMessage',
          sqs: expect.objectContaining({
            messageId: 'msg-123',
            message: 'not valid json {{{',
          }),
        }),
      )

      expect(mockDeleteMessage).toHaveBeenCalled()

      listener.close()
    }, 10000)

    test('should not delete message when onError returns do-not-delete-message for JSON error', async () => {
      const errorHandled = new Promise<void>((resolve) => {
        let callCount = 0
        receiveMessageImpl = () => {
          callCount++
          if (callCount === 1) {
            return Promise.resolve({
              Messages: [
                {
                  MessageId: 'msg-123',
                  Body: 'invalid json',
                  ReceiptHandle: 'receipt-123',
                },
              ],
            })
          }
          // Second call: resolve after a small delay, will be caught by close
          return new Promise((r) => setTimeout(() => r({ Messages: [] }), 200))
        }
      })

      const singleFunctionModule = module.build({
        name: 'single-function-module',
        functions: {
          processMessage: processMessageFunction,
        },
      })

      const api = sqs.build({
        module: singleFunctionModule,
        functions: {
          processMessage: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue' },
        },
      })

      const listener = listen({
        api,
        context: async () => ({}),
        onError: () => ({ action: 'do-not-delete-message' as const }),
      })

      // Wait a bit for processing
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Message should NOT be deleted
      expect(mockDeleteMessage).not.toHaveBeenCalled()

      listener.close()
    }, 10000)

    test('should handle empty messages array', async () => {
      let receiveCount = 0
      receiveMessageImpl = () => {
        receiveCount++
        if (receiveCount === 1) {
          return Promise.resolve({ Messages: [] })
        }
        return new Promise(() => {})
      }

      const singleFunctionModule = module.build({
        name: 'single-function-module',
        functions: {
          processMessage: processMessageFunction,
        },
      })

      const api = sqs.build({
        module: singleFunctionModule,
        functions: {
          processMessage: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue' },
        },
      })

      const listener = listen({
        api,
        context: async () => ({}),
        onError: () => {},
      })

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100))

      // No delete should be called
      expect(mockDeleteMessage).not.toHaveBeenCalled()

      listener.close()
    }, 10000)

    test('should handle undefined messages', async () => {
      let receiveCount = 0
      receiveMessageImpl = () => {
        receiveCount++
        if (receiveCount === 1) {
          return Promise.resolve({ Messages: undefined })
        }
        return new Promise(() => {})
      }

      const singleFunctionModule = module.build({
        name: 'single-function-module',
        functions: {
          processMessage: processMessageFunction,
        },
      })

      const api = sqs.build({
        module: singleFunctionModule,
        functions: {
          processMessage: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue' },
        },
      })

      const listener = listen({
        api,
        context: async () => ({}),
        onError: () => {},
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(mockDeleteMessage).not.toHaveBeenCalled()

      listener.close()
    }, 10000)

    test('should handle message with undefined body', async () => {
      const processed = new Promise<void>((resolve) => {
        let callCount = 0
        receiveMessageImpl = () => {
          callCount++
          if (callCount === 1) {
            return Promise.resolve({
              Messages: [
                {
                  MessageId: 'msg-123',
                  Body: undefined,
                  ReceiptHandle: 'receipt-123',
                },
              ],
            })
          }
          return new Promise(() => {})
        }
        deleteMessageImpl = () => {
          resolve()
          return Promise.resolve({})
        }
      })

      const singleFunctionModule = module.build({
        name: 'single-function-module',
        functions: {
          noInput: noInputFunction,
        },
      })

      const api = sqs.build({
        module: singleFunctionModule,
        functions: {
          noInput: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue' },
        },
      })

      const listener = listen({
        api,
        context: async () => ({}),
        onError: () => {},
      })

      await processed

      expect(mockDeleteMessage).toHaveBeenCalled()

      listener.close()
    }, 10000)

    test('should call onError for function execution errors', async () => {
      const onErrorMock = vi.fn()
      const errorCalled = new Promise<void>((resolve) => {
        let callCount = 0
        receiveMessageImpl = () => {
          callCount++
          if (callCount === 1) {
            return Promise.resolve({
              Messages: [
                {
                  MessageId: 'msg-123',
                  Body: JSON.stringify('throw'),
                  ReceiptHandle: 'receipt-123',
                },
              ],
            })
          }
          return new Promise(() => {})
        }
        deleteMessageImpl = () => {
          resolve()
          return Promise.resolve({})
        }
      })

      const singleFunctionModule = module.build({
        name: 'single-function-module',
        functions: {
          throwingProcessor: throwingFunction,
        },
      })

      const api = sqs.build({
        module: singleFunctionModule,
        functions: {
          throwingProcessor: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue' },
        },
      })

      const listener = listen({
        api,
        context: async () => ({}),
        onError: onErrorMock,
      })

      await errorCalled

      expect(onErrorMock).toHaveBeenCalledWith(
        expect.objectContaining({
          errorKind: 'function-apply',
          functionName: 'throwingProcessor',
        }),
      )

      listener.close()
    }, 10000)

    test('should call onError with invalid-input for decoding errors', async () => {
      const onErrorMock = vi.fn()
      const errorCalled = new Promise<void>((resolve) => {
        let callCount = 0
        receiveMessageImpl = () => {
          callCount++
          if (callCount === 1) {
            return Promise.resolve({
              Messages: [
                {
                  MessageId: 'msg-123',
                  Body: JSON.stringify('just a string'),
                  ReceiptHandle: 'receipt-123',
                },
              ],
            })
          }
          return new Promise(() => {})
        }
        deleteMessageImpl = () => {
          resolve()
          return Promise.resolve({})
        }
      })

      const singleFunctionModule = module.build({
        name: 'single-function-module',
        functions: {
          processMessage: processMessageFunction,
        },
      })

      const api = sqs.build({
        module: singleFunctionModule,
        functions: {
          processMessage: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue' },
        },
      })

      const listener = listen({
        api,
        context: async () => ({}),
        onError: onErrorMock,
      })

      await errorCalled

      expect(onErrorMock).toHaveBeenCalledWith(
        expect.objectContaining({
          errorKind: 'invalid-input',
          functionName: 'processMessage',
        }),
      )

      listener.close()
    }, 10000)

    test('should not delete message when onError returns do-not-delete-message for function error', async () => {
      let callCount = 0
      receiveMessageImpl = () => {
        callCount++
        if (callCount === 1) {
          return Promise.resolve({
            Messages: [
              {
                MessageId: 'msg-123',
                Body: JSON.stringify('throw'),
                ReceiptHandle: 'receipt-123',
              },
            ],
          })
        }
        return new Promise((r) => setTimeout(() => r({ Messages: [] }), 200))
      }

      const singleFunctionModule = module.build({
        name: 'single-function-module',
        functions: {
          throwingProcessor: throwingFunction,
        },
      })

      const api = sqs.build({
        module: singleFunctionModule,
        functions: {
          throwingProcessor: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue' },
        },
      })

      const listener = listen({
        api,
        context: async () => ({}),
        onError: () => ({ action: 'do-not-delete-message' as const }),
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(mockDeleteMessage).not.toHaveBeenCalled()

      listener.close()
    }, 10000)

    test('should delete message when onError returns delete-message action', async () => {
      const deleted = new Promise<void>((resolve) => {
        let callCount = 0
        receiveMessageImpl = () => {
          callCount++
          if (callCount === 1) {
            return Promise.resolve({
              Messages: [
                {
                  MessageId: 'msg-123',
                  Body: JSON.stringify('throw'),
                  ReceiptHandle: 'receipt-123',
                },
              ],
            })
          }
          return new Promise(() => {})
        }
        deleteMessageImpl = () => {
          resolve()
          return Promise.resolve({})
        }
      })

      const singleFunctionModule = module.build({
        name: 'single-function-module',
        functions: {
          throwingProcessor: throwingFunction,
        },
      })

      const api = sqs.build({
        module: singleFunctionModule,
        functions: {
          throwingProcessor: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue' },
        },
      })

      const listener = listen({
        api,
        context: async () => ({}),
        onError: () => ({ action: 'delete-message' as const }),
      })

      await deleted

      expect(mockDeleteMessage).toHaveBeenCalled()

      listener.close()
    }, 10000)

    test('should handle receiveMessage errors and retry', async () => {
      let callCount = 0
      receiveMessageImpl = () => {
        callCount++
        if (callCount === 1) {
          return Promise.reject(new Error('Network error'))
        }
        return new Promise((r) => setTimeout(() => r({ Messages: [] }), 50))
      }

      const singleFunctionModule = module.build({
        name: 'single-function-module',
        functions: {
          processMessage: processMessageFunction,
        },
      })

      const api = sqs.build({
        module: singleFunctionModule,
        functions: {
          processMessage: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue' },
        },
      })

      const listener = listen({
        api,
        context: async () => ({}),
        onError: () => {},
      })

      // Wait for retry loop
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // Should have retried
      expect(callCount).toBeGreaterThan(1)

      listener.close()
    }, 10000)

    test('should handle multiple messages with length != 1', async () => {
      let receiveCount = 0
      receiveMessageImpl = () => {
        receiveCount++
        if (receiveCount === 1) {
          return Promise.resolve({
            Messages: [
              { MessageId: 'msg-1', Body: JSON.stringify({ message: 'hello1' }), ReceiptHandle: 'receipt-1' },
              { MessageId: 'msg-2', Body: JSON.stringify({ message: 'hello2' }), ReceiptHandle: 'receipt-2' },
            ],
          })
        }
        return new Promise((r) => setTimeout(() => r({ Messages: [] }), 200))
      }

      const singleFunctionModule = module.build({
        name: 'single-function-module',
        functions: {
          processMessage: processMessageFunction,
        },
      })

      const api = sqs.build({
        module: singleFunctionModule,
        functions: {
          processMessage: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue' },
        },
      })

      const listener = listen({
        api,
        context: async () => ({}),
        onError: () => {},
      })

      // Wait a bit for processing
      await new Promise((resolve) => setTimeout(resolve, 100))

      // When messages.length != 1, handleMessages returns early without processing
      expect(mockDeleteMessage).not.toHaveBeenCalled()

      listener.close()
    }, 10000)
  })

  describe('message body fallback', () => {
    test('passes empty string to onError when JSON parsing fails on empty body', async () => {
      const onErrorMock = vi.fn().mockResolvedValue(undefined)

      const errored = new Promise<void>((resolve) => {
        let callCount = 0
        receiveMessageImpl = () => {
          callCount++
          if (callCount === 1) {
            return Promise.resolve({
              Messages: [
                {
                  MessageId: 'msg-empty',
                  // empty string is defined (not undefined) so JSON.parse will be invoked,
                  // and JSON.parse('') throws — driving execution into the catch branch
                  // where `m.Body ?? ''` is exercised with a falsy body.
                  Body: '',
                  ReceiptHandle: 'receipt-empty',
                },
              ],
            })
          }
          return new Promise(() => {})
        }
        deleteMessageImpl = () => {
          resolve()
          return Promise.resolve({})
        }
      })

      const singleFunctionModule = module.build({
        name: 'single-function-module',
        functions: { processMessage: processMessageFunction },
      })

      const api = sqs.build({
        module: singleFunctionModule,
        functions: {
          processMessage: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue' },
        },
      })

      const listener = listen({
        api,
        context: async () => ({}),
        onError: onErrorMock,
      })

      await errored

      expect(onErrorMock).toHaveBeenCalledWith(
        expect.objectContaining({
          errorKind: 'invalid-input',
          sqs: expect.objectContaining({ message: '' }),
        }),
      )

      listener.close()
    }, 10000)

    test('passes empty string to onError when function-apply fails on null body', async () => {
      const onErrorMock = vi.fn().mockResolvedValue(undefined)

      const errored = new Promise<void>((resolve) => {
        let callCount = 0
        receiveMessageImpl = () => {
          callCount++
          if (callCount === 1) {
            return Promise.resolve({
              Messages: [
                {
                  MessageId: 'msg-null',
                  // `null` is not strictly equal to undefined, so JSON.parse runs and
                  // returns the JS value `null`; then rawApply fails decoding which
                  // drives execution into the function-apply error path.
                  Body: null as any,
                  ReceiptHandle: 'receipt-null',
                },
              ],
            })
          }
          return new Promise(() => {})
        }
        deleteMessageImpl = () => {
          resolve()
          return Promise.resolve({})
        }
      })

      const singleFunctionModule = module.build({
        name: 'single-function-module',
        functions: { processMessage: processMessageFunction },
      })

      const api = sqs.build({
        module: singleFunctionModule,
        functions: {
          processMessage: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue' },
        },
      })

      const listener = listen({
        api,
        context: async () => ({}),
        onError: onErrorMock,
      })

      await errored

      expect(onErrorMock).toHaveBeenCalledWith(
        expect.objectContaining({
          sqs: expect.objectContaining({ message: '' }),
        }),
      )

      listener.close()
    }, 10000)
  })

  describe('skips functions without specifications', () => {
    test('should skip module functions that are not in api.functions', async () => {
      // Build an Api object directly (bypassing sqs.build validation) so that
      // the module has two functions but api.functions only contains one of them.
      // This exercises the `if (!specifications) continue` branch in listener.ts.
      let receiveCount = 0
      receiveMessageImpl = () => {
        receiveCount++
        return new Promise((resolve) => setTimeout(() => resolve({ Messages: [] }), 50))
      }

      const twoFunctionModule = module.build({
        name: 'two-fn-module',
        functions: {
          processMessage: processMessageFunction,
          numberProcessor: numberFunction,
        },
      })

      // Manually craft Api - skipping `numberProcessor` from api.functions
      const api = {
        module: twoFunctionModule,
        functions: {
          processMessage: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue' },
        },
      } as any

      const listener = listen({
        api,
        context: async () => ({}),
        onError: () => {},
      })

      // Wait briefly for the polling loop to start
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Only one queue should be receiving messages (the one with a spec).
      // Each receiveMessage call uses the queueUrl, so verify only the configured queue is called.
      const calledQueues = mockReceiveMessage.mock.calls.map((c: any[]) => c[0]?.QueueUrl)
      const uniqueQueues = Array.from(new Set(calledQueues))
      expect(uniqueQueues).toEqual(['https://sqs.us-east-1.amazonaws.com/123456789012/test-queue'])
      expect(receiveCount).toBeGreaterThan(0)

      await listener.close()
    })
  })

  describe('close functionality', () => {
    test('should stop listening when close is called', async () => {
      let receiveCallCount = 0
      receiveMessageImpl = () => {
        receiveCallCount++
        return new Promise((resolve) => {
          setTimeout(() => resolve({ Messages: [] }), 50)
        })
      }

      const singleFunctionModule = module.build({
        name: 'single-function-module',
        functions: {
          processMessage: processMessageFunction,
        },
      })

      const api = sqs.build({
        module: singleFunctionModule,
        functions: {
          processMessage: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue' },
        },
      })

      const listener = listen({
        api,
        context: async () => ({}),
        onError: () => {},
      })

      await new Promise((resolve) => setTimeout(resolve, 200))
      const callCountBeforeClose = receiveCallCount

      await listener.close()

      // Wait to see if more calls happen
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Should not have many more calls after close
      expect(receiveCallCount).toBeLessThanOrEqual(callCountBeforeClose + 2)
    })
  })
})

// =============================================================================
// Tests for exports
// =============================================================================

describe('exports', () => {
  test('should export listen function', () => {
    expect(listen).toBeDefined()
    expect(typeof listen).toBe('function')
  })

  test('should export sqs namespace with build and define', () => {
    expect(sqs).toBeDefined()
    expect(sqs.build).toBeDefined()
    expect(sqs.define).toBeDefined()
    expect(typeof sqs.build).toBe('function')
    expect(typeof sqs.define).toBe('function')
  })
})
