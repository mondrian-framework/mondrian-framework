import { Api } from './api'
import { objectToZodShape } from './utils'
import { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { model } from '@mondrian-framework/model'
import { functions, logger, module, retrieve } from '@mondrian-framework/module'
import { mapObject } from '@mondrian-framework/utils'
import { IncomingMessage, ServerResponse } from 'http'

export function buildServer<Fs extends functions.FunctionImplementations>({
  api,
  context,
}: {
  api: Api<Fs>
  context: (authInfo?: AuthInfo) => Promise<module.FunctionsToContextInput<Fs>>
}): McpServer {
  const server = new McpServer(
    {
      name: api.module.name,
      version: api.version ?? '1.0.0',
    },
    {
      instructions: api.instructions,
    },
  )
  for (const [functionName, functionSpecification] of Object.entries(api.functions)) {
    if (!functionSpecification) {
      continue
    }
    const functionBody = api.module.functions[functionName]
    const specifications = Array.isArray(functionSpecification) ? functionSpecification : [functionSpecification]
    const thisLogger = logger.build({
      moduleName: api.module.name,
      operationName: functionName,
      operationType: 'tool',
      server: 'MCP',
    })
    const partialOutputType = model.concretise(model.partialDeep(functionBody.output))

    for (const specification of specifications) {
      const retrieveType = retrieve.fromType(functionBody.output, functionBody.retrieve)
      const inputField = model.isLiteral(functionBody.input, undefined) ? ({} as {}) : { input: functionBody.input }
      const inputType = retrieveType.isOk
        ? model.object({ ...inputField, ...retrieveType.value.fields })
        : model.object(inputField)
      server.tool(
        specification.name ?? functionName,
        specification.description ?? functionBody.options?.description ?? '',
        objectToZodShape(inputType),
        async (inputObject, extra) => {
          const rawInput = inputObject.input

          const rawRetrieve = { ...inputObject }
          delete rawRetrieve.input
          if (rawRetrieve.select && Object.keys(rawRetrieve.select).length === 0) {
            delete rawRetrieve.select
          }

          //Context input retrieval
          const contextInput = await context(extra.authInfo)

          const decodingOptions = specification.decodingOptions ?? api.options?.decodingOptions
          // Function call
          const applyResult = await functionBody.rawApply({
            rawRetrieve,
            rawInput,
            contextInput: contextInput as Record<string, unknown>,
            logger: thisLogger,
            decodingOptions: { ...decodingOptions, typeCastingStrategy: 'tryCasting' },
            retrieveDecodingOptions: { ...decodingOptions, typeCastingStrategy: 'tryCasting' },
          })

          if (applyResult.isFailure) {
            const encodedError = mapObject(applyResult.error, (key, value) =>
              model.concretise((functionBody.errors ?? {})[key]).encodeWithoutValidation(value as never),
            )
            return {
              isError: true,
              content: [{ type: 'text', text: JSON.stringify(encodedError) }],
            }
          } else {
            const encodedOutput = model
              .concretise(partialOutputType)
              .encodeWithoutValidation(applyResult.value as never)
            return {
              content: [{ type: 'text', text: JSON.stringify(encodedOutput) }],
            }
          }
        },
      )
    }
  }
  return server
}

export function buildHttpStreamableHandler<Fs extends functions.FunctionImplementations, ServerContext>({
  api,
  context,
}: {
  api: Api<Fs>
  context: (
    request: IncomingMessage,
    response: ServerResponse,
    authInfo?: AuthInfo,
  ) => Promise<module.FunctionsToContextInput<Fs>>
}): (request: IncomingMessage, response: ServerResponse, body?: unknown) => Promise<void> {
  return async (request, response, body) => {
    try {
      const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      })
      const server = buildServer({ api, context: (authInfo) => context(request, response, authInfo) })
      await server.connect(transport)
      response.on('close', () => {
        transport.close()
        server.close()
      })
      //extract the body from the request
      const readBody = body
        ? ''
        : await new Promise<string>((resolve, reject) => {
            let body = ''
            request.on('data', (chunk) => {
              body += chunk
            })
            request.on('end', () => {
              resolve(body)
            })
          })
      const json = body ?? JSON.parse(readBody)
      await transport.handleRequest(request, response, json)
    } catch (error) {
      console.error('Error handling MCP request:', error)
      if (!response.headersSent) {
        response.writeHead(500, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify({ error: 'Internal server error' }))
      }
    }
  }
}
