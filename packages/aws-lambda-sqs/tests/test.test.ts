import { handler } from '../src'
import { model, result } from '@mondrian-framework/model'
import { exception, functions, module } from '@mondrian-framework/module'
import type { Context, SQSEvent, SQSRecord } from 'aws-lambda'
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'

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

// =============================================================================
// Helper Functions
// =============================================================================

function createSQSRecord(overrides: Partial<SQSRecord> = {}): SQSRecord {
  return {
    messageId: 'msg-' + Math.random().toString(36).substr(2, 9),
    receiptHandle: 'receipt-handle',
    body: JSON.stringify({ message: 'test message' }),
    attributes: {
      ApproximateReceiveCount: '1',
      SentTimestamp: '1234567890',
      SenderId: 'sender-id',
      ApproximateFirstReceiveTimestamp: '1234567890',
    },
    messageAttributes: {},
    md5OfBody: 'md5hash',
    eventSource: 'aws:sqs',
    eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
    awsRegion: 'us-east-1',
    ...overrides,
  }
}

function createSQSEvent(records: SQSRecord[] = [createSQSRecord()]): SQSEvent {
  return {
    Records: records,
  }
}

function createMockContext(): Context {
  return {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'test-function',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
    memoryLimitInMB: '128',
    awsRequestId: 'request-id',
    logGroupName: '/aws/lambda/test-function',
    logStreamName: '2024/01/01/[$LATEST]abc123',
    getRemainingTimeInMillis: () => 30000,
    done: vi.fn(),
    fail: vi.fn(),
    succeed: vi.fn(),
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('handler.build', () => {
  describe('basic handler creation', () => {
    test('should create a valid AWS Lambda SQS handler', () => {
      const sqsHandler = handler.build({
        module: testModule,
        api: {
          functions: {
            processMessage: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue' },
          },
        },
        context: async () => ({}),
      })

      expect(sqsHandler).toBeDefined()
      expect(typeof sqsHandler).toBe('function')
    })

    test('should handle empty functions api gracefully', () => {
      const sqsHandler = handler.build({
        module: testModule,
        api: {
          functions: {},
        },
        context: async () => ({}),
      })

      expect(sqsHandler).toBeDefined()
    })
  })

  describe('queue URL matching', () => {
    test('should process message when queue URL matches', async () => {
      const sqsHandler = handler.build({
        module: testModule,
        api: {
          functions: {
            processMessage: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue' },
          },
        },
        context: async () => ({}),
      })

      const event = createSQSEvent([
        createSQSRecord({
          body: JSON.stringify({ message: 'hello world' }),
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
        }),
      ])

      const result = await sqsHandler(event, createMockContext(), () => {})
      expect(result).toBeUndefined()
    })

    test('should skip message when queue URL does not match', async () => {
      const sqsHandler = handler.build({
        module: testModule,
        api: {
          functions: {
            processMessage: { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/different-queue' },
          },
        },
        context: async () => ({}),
      })

      const event = createSQSEvent([
        createSQSRecord({
          body: JSON.stringify({ message: 'hello world' }),
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
        }),
      ])

      const result = await sqsHandler(event, createMockContext(), () => {})
      expect(result).toBeUndefined()
    })

    test('should process message with anyQueue specification', async () => {
      const sqsHandler = handler.build({
        module: testModule,
        api: {
          functions: {
            processMessage: { anyQueue: true },
          },
        },
        context: async () => ({}),
      })

      const event = createSQSEvent([
        createSQSRecord({
          body: JSON.stringify({ message: 'hello from any queue' }),
          eventSourceARN: 'arn:aws:sqs:us-west-2:999999999999:random-queue',
        }),
      ])

      const result = await sqsHandler(event, createMockContext(), () => {})
      expect(result).toBeUndefined()
    })
  })

  describe('multiple function specifications', () => {
    test('should support array of specifications for a function', async () => {
      const sqsHandler = handler.build({
        module: testModule,
        api: {
          functions: {
            processMessage: [
              { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/queue-1' },
              { queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/queue-2' },
            ],
          },
        },
        context: async () => ({}),
      })

      // Test first queue
      const event1 = createSQSEvent([
        createSQSRecord({
          body: JSON.stringify({ message: 'from queue 1' }),
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:queue-1',
        }),
      ])

      const result1 = await sqsHandler(event1, createMockContext(), () => {})
      expect(result1).toBeUndefined()

      // Test second queue
      const event2 = createSQSEvent([
        createSQSRecord({
          body: JSON.stringify({ message: 'from queue 2' }),
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:queue-2',
        }),
      ])

      const result2 = await sqsHandler(event2, createMockContext(), () => {})
      expect(result2).toBeUndefined()
    })

    test('should handle undefined function specification', async () => {
      const sqsHandler = handler.build({
        module: testModule,
        api: {
          functions: {
            processMessage: undefined,
          },
        },
        context: async () => ({}),
      })

      const event = createSQSEvent([
        createSQSRecord({
          body: JSON.stringify({ message: 'test' }),
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
        }),
      ])

      const result = await sqsHandler(event, createMockContext(), () => {})
      expect(result).toBeUndefined()
    })
  })

  describe('malformed message handling', () => {
    test('should delete malformed message when malformedMessagePolicy is delete', async () => {
      const sqsHandler = handler.build({
        module: testModule,
        api: {
          functions: {
            processMessage: {
              queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue',
              malformedMessagePolicy: 'delete',
            },
          },
        },
        context: async () => ({}),
      })

      const event = createSQSEvent([
        createSQSRecord({
          body: 'not valid json {{{',
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
        }),
      ])

      const result = await sqsHandler(event, createMockContext(), () => {})
      expect(result).toBeUndefined()
    })

    test('should throw error for malformed message when malformedMessagePolicy is not delete and reportBatchItemFailures is false', async () => {
      const sqsHandler = handler.build({
        module: testModule,
        api: {
          functions: {
            processMessage: {
              queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue',
              malformedMessagePolicy: 'ignore',
              reportBatchItemFailures: false,
            },
          },
        },
        context: async () => ({}),
      })

      const event = createSQSEvent([
        createSQSRecord({
          body: 'not valid json',
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
        }),
      ])

      await expect(sqsHandler(event, createMockContext(), () => {})).rejects.toThrow('Bad message')
    })

    test('should report batch item failure for malformed message when reportBatchItemFailures is true', async () => {
      const sqsHandler = handler.build({
        module: testModule,
        api: {
          functions: {
            processMessage: {
              queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue',
              reportBatchItemFailures: true,
            },
          },
        },
        context: async () => ({}),
      })

      const messageId = 'msg-123'
      const event = createSQSEvent([
        createSQSRecord({
          messageId,
          body: 'invalid json {{',
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
        }),
      ])

      const result = await sqsHandler(event, createMockContext(), () => {})
      // The message ID appears twice because:
      // 1. First push when JSON parsing fails
      // 2. Second push when rawApply is called with undefined body (which fails schema validation)
      expect(result).toEqual({
        batchItemFailures: [{ itemIdentifier: messageId }, { itemIdentifier: messageId }],
      })
    })

    test('should handle undefined body', async () => {
      const sqsHandler = handler.build({
        module: testModule,
        api: {
          functions: {
            optionalInput: {
              queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue',
            },
          },
        },
        context: async () => ({}),
      })

      const event = createSQSEvent([
        createSQSRecord({
          body: undefined as any,
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
        }),
      ])

      const result = await sqsHandler(event, createMockContext(), () => {})
      expect(result).toBeUndefined()
    })
  })

  describe('batch item failure reporting', () => {
    test('should return batchItemFailures when reportBatchItemFailures is true and processing fails', async () => {
      const sqsHandler = handler.build({
        module: testModule,
        api: {
          functions: {
            throwingProcessor: {
              queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue',
              reportBatchItemFailures: true,
            },
          },
        },
        context: async () => ({}),
      })

      const messageId = 'failing-msg-456'
      const event = createSQSEvent([
        createSQSRecord({
          messageId,
          body: JSON.stringify('throw'),
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
        }),
      ])

      const result = await sqsHandler(event, createMockContext(), () => {})
      expect(result).toEqual({
        batchItemFailures: [{ itemIdentifier: messageId }],
      })
    })

    test('should throw error when reportBatchItemFailures is false and processing fails', async () => {
      const sqsHandler = handler.build({
        module: testModule,
        api: {
          functions: {
            throwingProcessor: {
              queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue',
              reportBatchItemFailures: false,
            },
          },
        },
        context: async () => ({}),
      })

      const event = createSQSEvent([
        createSQSRecord({
          body: JSON.stringify('throw'),
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
        }),
      ])

      await expect(sqsHandler(event, createMockContext(), () => {})).rejects.toThrow()
    })

    test('should return empty batchItemFailures when all messages process successfully', async () => {
      const sqsHandler = handler.build({
        module: testModule,
        api: {
          functions: {
            processMessage: {
              queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue',
              reportBatchItemFailures: true,
            },
          },
        },
        context: async () => ({}),
      })

      const event = createSQSEvent([
        createSQSRecord({
          body: JSON.stringify({ message: 'test1' }),
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
        }),
        createSQSRecord({
          body: JSON.stringify({ message: 'test2' }),
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
        }),
      ])

      const result = await sqsHandler(event, createMockContext(), () => {})
      expect(result).toEqual({
        batchItemFailures: [],
      })
    })

    test('should report multiple batch item failures', async () => {
      const sqsHandler = handler.build({
        module: testModule,
        api: {
          functions: {
            throwingProcessor: {
              queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue',
              reportBatchItemFailures: true,
            },
          },
        },
        context: async () => ({}),
      })

      const msgId1 = 'fail-1'
      const msgId2 = 'fail-2'
      const event = createSQSEvent([
        createSQSRecord({
          messageId: msgId1,
          body: JSON.stringify('throw'),
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
        }),
        createSQSRecord({
          messageId: msgId2,
          body: JSON.stringify('throw'),
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
        }),
      ])

      const result = await sqsHandler(event, createMockContext(), () => {})
      expect(result).toEqual({
        batchItemFailures: [{ itemIdentifier: msgId1 }, { itemIdentifier: msgId2 }],
      })
    })

    test('should report partial batch item failures', async () => {
      const sqsHandler = handler.build({
        module: testModule,
        api: {
          functions: {
            throwingProcessor: {
              queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue',
              reportBatchItemFailures: true,
            },
          },
        },
        context: async () => ({}),
      })

      const successMsgId = 'success-1'
      const failMsgId = 'fail-1'
      const event = createSQSEvent([
        createSQSRecord({
          messageId: successMsgId,
          body: JSON.stringify('success'),
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
        }),
        createSQSRecord({
          messageId: failMsgId,
          body: JSON.stringify('throw'),
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
        }),
      ])

      const result = await sqsHandler(event, createMockContext(), () => {})
      expect(result).toEqual({
        batchItemFailures: [{ itemIdentifier: failMsgId }],
      })
    })
  })

  describe('InvalidInput handling with malformedMessagePolicy', () => {
    test('should delete message on InvalidInput when malformedMessagePolicy is delete', async () => {
      const sqsHandler = handler.build({
        module: testModule,
        api: {
          functions: {
            processMessage: {
              queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue',
              malformedMessagePolicy: 'delete',
            },
          },
        },
        context: async () => ({}),
      })

      // Send a message that is valid JSON but doesn't match the expected schema
      const event = createSQSEvent([
        createSQSRecord({
          body: JSON.stringify({ wrongField: 'value' }),
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
        }),
      ])

      const result = await sqsHandler(event, createMockContext(), () => {})
      expect(result).toBeUndefined()
    })

    test('should throw on InvalidInput when malformedMessagePolicy is not delete', async () => {
      const sqsHandler = handler.build({
        module: testModule,
        api: {
          functions: {
            processMessage: {
              queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue',
              malformedMessagePolicy: 'ignore',
              reportBatchItemFailures: false,
            },
          },
        },
        context: async () => ({}),
      })

      // Send a message that is valid JSON but doesn't match the expected schema
      const event = createSQSEvent([
        createSQSRecord({
          body: JSON.stringify({ wrongField: 'value' }),
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
        }),
      ])

      await expect(sqsHandler(event, createMockContext(), () => {})).rejects.toThrow()
    })
  })

  describe('context handling', () => {
    test('should pass correct context arguments to context function', async () => {
      const contextMock = vi.fn().mockResolvedValue({})

      const sqsHandler = handler.build({
        module: testModule,
        api: {
          functions: {
            processMessage: {
              queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue',
            },
          },
        },
        context: contextMock,
      })

      const event = createSQSEvent([
        createSQSRecord({
          body: JSON.stringify({ message: 'test' }),
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
        }),
      ])

      const lambdaContext = createMockContext()
      await sqsHandler(event, lambdaContext, () => {})

      expect(contextMock).toHaveBeenCalledWith({
        event,
        context: lambdaContext,
        recordIndex: 0,
      })
    })

    test('should pass correct recordIndex for each record', async () => {
      const contextMock = vi.fn().mockResolvedValue({})

      const sqsHandler = handler.build({
        module: testModule,
        api: {
          functions: {
            processMessage: {
              queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue',
            },
          },
        },
        context: contextMock,
      })

      const event = createSQSEvent([
        createSQSRecord({
          body: JSON.stringify({ message: 'msg1' }),
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
        }),
        createSQSRecord({
          body: JSON.stringify({ message: 'msg2' }),
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
        }),
        createSQSRecord({
          body: JSON.stringify({ message: 'msg3' }),
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
        }),
      ])

      await sqsHandler(event, createMockContext(), () => {})

      expect(contextMock).toHaveBeenCalledTimes(3)
      expect(contextMock).toHaveBeenNthCalledWith(1, expect.objectContaining({ recordIndex: 0 }))
      expect(contextMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ recordIndex: 1 }))
      expect(contextMock).toHaveBeenNthCalledWith(3, expect.objectContaining({ recordIndex: 2 }))
    })
  })

  describe('multiple records processing', () => {
    test('should process multiple records from the same queue', async () => {
      const sqsHandler = handler.build({
        module: testModule,
        api: {
          functions: {
            numberProcessor: {
              queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue',
            },
          },
        },
        context: async () => ({}),
      })

      const event = createSQSEvent([
        createSQSRecord({
          body: JSON.stringify(1),
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
        }),
        createSQSRecord({
          body: JSON.stringify(2),
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
        }),
        createSQSRecord({
          body: JSON.stringify(3),
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
        }),
      ])

      const result = await sqsHandler(event, createMockContext(), () => {})
      expect(result).toBeUndefined()
    })

    test('should handle empty records array', async () => {
      const sqsHandler = handler.build({
        module: testModule,
        api: {
          functions: {
            processMessage: {
              queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue',
            },
          },
        },
        context: async () => ({}),
      })

      const event = createSQSEvent([])

      const result = await sqsHandler(event, createMockContext(), () => {})
      expect(result).toBeUndefined()
    })
  })

  describe('different AWS regions', () => {
    test('should construct correct queue URL from different region ARNs', async () => {
      const sqsHandler = handler.build({
        module: testModule,
        api: {
          functions: {
            processMessage: {
              queueUrl: 'https://sqs.eu-west-1.amazonaws.com/987654321098:my-eu-queue',
            },
          },
        },
        context: async () => ({}),
      })

      const event = createSQSEvent([
        createSQSRecord({
          body: JSON.stringify({ message: 'eu message' }),
          eventSourceARN: 'arn:aws:sqs:eu-west-1:987654321098:my-eu-queue',
        }),
      ])

      const result = await sqsHandler(event, createMockContext(), () => {})
      expect(result).toBeUndefined()
    })

    test('should match queue URL from ap-southeast-1 region', async () => {
      const sqsHandler = handler.build({
        module: testModule,
        api: {
          functions: {
            processMessage: {
              queueUrl: 'https://sqs.ap-southeast-1.amazonaws.com/111222333444/asia-queue',
            },
          },
        },
        context: async () => ({}),
      })

      const event = createSQSEvent([
        createSQSRecord({
          body: JSON.stringify({ message: 'asia message' }),
          eventSourceARN: 'arn:aws:sqs:ap-southeast-1:111222333444:asia-queue',
        }),
      ])

      const result = await sqsHandler(event, createMockContext(), () => {})
      expect(result).toBeUndefined()
    })
  })

  describe('edge cases', () => {
    test('should handle special characters in message body', async () => {
      const sqsHandler = handler.build({
        module: testModule,
        api: {
          functions: {
            processMessage: {
              queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue',
            },
          },
        },
        context: async () => ({}),
      })

      const event = createSQSEvent([
        createSQSRecord({
          body: JSON.stringify({ message: 'Special chars: \n\t\r "quotes" \'apostrophe\' \\backslash' }),
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
        }),
      ])

      const result = await sqsHandler(event, createMockContext(), () => {})
      expect(result).toBeUndefined()
    })

    test('should handle unicode in message body', async () => {
      const sqsHandler = handler.build({
        module: testModule,
        api: {
          functions: {
            processMessage: {
              queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue',
            },
          },
        },
        context: async () => ({}),
      })

      const event = createSQSEvent([
        createSQSRecord({
          body: JSON.stringify({ message: 'Unicode: 你好世界 🎉 émoji' }),
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
        }),
      ])

      const result = await sqsHandler(event, createMockContext(), () => {})
      expect(result).toBeUndefined()
    })

    test('should handle very long message body', async () => {
      const sqsHandler = handler.build({
        module: testModule,
        api: {
          functions: {
            processMessage: {
              queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue',
            },
          },
        },
        context: async () => ({}),
      })

      const longMessage = 'a'.repeat(10000)
      const event = createSQSEvent([
        createSQSRecord({
          body: JSON.stringify({ message: longMessage }),
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
        }),
      ])

      const result = await sqsHandler(event, createMockContext(), () => {})
      expect(result).toBeUndefined()
    })

    test('should handle empty string message body', async () => {
      const sqsHandler = handler.build({
        module: testModule,
        api: {
          functions: {
            optionalInput: {
              queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue',
            },
          },
        },
        context: async () => ({}),
      })

      const event = createSQSEvent([
        createSQSRecord({
          body: JSON.stringify(''),
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
        }),
      ])

      const result = await sqsHandler(event, createMockContext(), () => {})
      expect(result).toBeUndefined()
    })

    test('should handle null JSON body', async () => {
      const sqsHandler = handler.build({
        module: testModule,
        api: {
          functions: {
            optionalInput: {
              queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue',
            },
          },
        },
        context: async () => ({}),
      })

      const event = createSQSEvent([
        createSQSRecord({
          body: 'null',
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
        }),
      ])

      const result = await sqsHandler(event, createMockContext(), () => {})
      expect(result).toBeUndefined()
    })
  })

  describe('non-Error exception handling', () => {
    test('should handle non-Error exceptions with reportBatchItemFailures', async () => {
      // Create a function that throws a non-Error
      const throwNonErrorFunction = functions
        .define({
          input: model.string(),
          output: model.string(),
        })
        .implement({
          async body() {
            throw 'string error' // Non-Error throw
          },
        })

      const nonErrorModule = module.build({
        name: 'non-error-module',
        functions: {
          throwNonError: throwNonErrorFunction,
        },
      })

      const sqsHandler = handler.build({
        module: nonErrorModule,
        api: {
          functions: {
            throwNonError: {
              queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue',
              reportBatchItemFailures: true,
            },
          },
        },
        context: async () => ({}),
      })

      const messageId = 'non-error-msg'
      const event = createSQSEvent([
        createSQSRecord({
          messageId,
          body: JSON.stringify('test'),
          eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
        }),
      ])

      const result = await sqsHandler(event, createMockContext(), () => {})
      expect(result).toEqual({
        batchItemFailures: [{ itemIdentifier: messageId }],
      })
    })
  })
})
