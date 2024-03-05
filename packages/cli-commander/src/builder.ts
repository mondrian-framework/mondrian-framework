import { decoding, model, result } from '@mondrian-framework/model'
import { functions, logger, module } from '@mondrian-framework/module'
import { capitalise, isArray, uncapitalise } from '@mondrian-framework/utils'
import { program as p, Command } from 'commander'

type InputBindingStyle = 'single-json' | 'argument-spreaded'

type CommandSpecification = {
  commandName?: string
  inputBindingStyle?: InputBindingStyle
}

const decodingOptions: decoding.Options = {
  errorReportingStrategy: 'stopAtFirstError',
  fieldStrictness: 'allowAdditionalFields',
  typeCastingStrategy: 'tryCasting',
}

const defaultOutputHandler = async (result: result.Result<unknown, unknown>) => {
  if (result.isOk) {
    console.log(JSON.stringify(result.value, null, 2))
  } else {
    process.exitCode = 1
    console.error(JSON.stringify(result.error, null, 2))
  }
}

type Api<Fs extends functions.FunctionImplementations> = {
  programVersion?: string
  inputBindingStyle?: InputBindingStyle
  functions: {
    [K in keyof Fs]?: CommandSpecification | CommandSpecification[]
  }
  module: module.Module<Fs>
  output?: (
    result: result.Result<unknown, unknown>,
    args: { functionName: string },
    handler: () => Promise<void>,
  ) => Promise<void>
}

/**
 * Creates a new cli program with commander from a cli api specification.
 */
export function fromModule<Fs extends functions.FunctionImplementations>({
  context,
  ...api
}: {
  context: () => Promise<module.FunctionsToContextInput<Fs>>
} & Api<Fs>): Command {
  const program = p.name(api.module.name)
  if (api.programVersion) {
    program.version(api.programVersion)
  }
  if (api.module.description) {
    program.description(api.module.description)
  }
  program.name(api.module.name)

  const outputHandler = api.output ?? defaultOutputHandler
  const baseLogger = logger.build({ moduleName: api.module.name, server: 'CLI' })
  for (const [functionName, cmdSpecs] of Object.entries(api.functions)) {
    if (!cmdSpecs) {
      continue
    }
    for (const cmdSpec of isArray(cmdSpecs) ? cmdSpecs : [cmdSpecs]) {
      const functionBody = api.module.functions[functionName]
      const inputBindingStyle =
        (typeof cmdSpec === 'object' ? cmdSpec.inputBindingStyle : null) ?? api.inputBindingStyle ?? 'single-json'
      const cmdName = cmdSpec.commandName ?? functionName
      const command = program.command(cmdName)
      if (functionBody.options?.description) {
        command.description(functionBody.options.description)
      }
      const decoder = (inputBindingStyle === 'argument-spreaded' ? argumentSpreadedBinding : singleJsonBinding)({
        command,
        input: functionBody.input,
        functionName,
      })

      command.action(async (cmdInput) => {
        const inputResult = decoder(cmdInput)
        if (inputResult.isFailure) {
          await outputHandler(inputResult, { functionName }, () => defaultOutputHandler(inputResult))
          return
        }
        try {
          const contextInput = await context()
          //TODO: how to use rawApply?
          const applyResult = await functionBody.apply({
            contextInput: contextInput as Record<string, unknown>,
            input: inputResult.value as any,
            retrieve: undefined as any,
            logger: baseLogger,
            //tracer: functionBody.tracer, //TODO: add opentelemetry istrumentation
          })
          await outputHandler(applyResult, { functionName }, () => defaultOutputHandler(applyResult))
        } catch (error) {
          await outputHandler(result.fail(error), { functionName }, () => defaultOutputHandler(result.fail(error)))
        }
      })
    }
  }

  return program
}

const argumentSpreadedBinding: (args: {
  command: Command
  input: model.Type
  functionName: string
}) => (cmdInput: any) => result.Result<unknown, unknown> = ({ command, input, functionName }) => {
  return model.match(input, {
    scalar: (scalar) => {
      command.argument(`<${scalar.options?.name ?? 'input'}>`, scalar.options?.description)
      return (str: string) => scalar.decode(str, decodingOptions)
    },
    record: (obj) => {
      for (const [fieldName, fieldType] of Object.entries(obj.fields)) {
        const concreteFieldType = model.concretise(fieldType)
        if (model.isOptional(fieldType) || model.isLiteral(fieldType, undefined)) {
          command.option(`--${fieldName} <value>`, concreteFieldType.options?.description)
        } else {
          command.requiredOption(`--${fieldName} <value>`, concreteFieldType.options?.description)
        }
      }
      const keys = Object.fromEntries(
        Object.keys(obj.fields).map((k) => [uncapitalise(k.split('-').map(capitalise).join('')), k]),
      )
      return (args: Record<string, string>) => {
        const mappedArgs = Object.fromEntries(
          Object.entries(args)
            //remove camel-case
            .map(([k, v]) => (keys[k] ? [keys[k], v] : [k, v]))
            .map(([k, v]) => {
              try {
                return [k, JSON.parse(v)]
              } catch {
                return [k, v]
              }
            }),
        )
        return obj.decode(mappedArgs, decodingOptions)
      }
    },
    otherwise: () => {
      throw new Error(
        `Impposible input binding 'argument-spreaded' on function ${functionName}.\nOnly object, entity or scalar are supported as input type.\nYou can use 'single-json' input binding in CLI API settings`,
      )
    },
  })
}

const singleJsonBinding: (args: {
  command: Command
  input: model.Type
}) => (jsonStr: string | undefined) => result.Result<unknown, unknown> = ({ command, input }) => {
  const concreteInput = model.concretise(input)
  const example = concreteInput.encodeWithoutValidation(concreteInput.example() as never)
  const exampleStr = JSON.stringify(example === undefined ? null : example)
  const name = concreteInput.options?.name ?? 'input'
  const description = `${concreteInput.options?.description ?? ''} Example: '${exampleStr}'`
  if (model.isOptional(concreteInput) || model.isLiteral(concreteInput, undefined)) {
    command.argument(`[${name}]`, description)
  } else {
    command.argument(`<${name}>`, description)
  }
  return (jsonStr: string | undefined) => {
    if (jsonStr === undefined) {
      jsonStr = 'null'
    }
    try {
      return concreteInput.decode(JSON.parse(jsonStr), decodingOptions)
    } catch (error) {
      try {
        return concreteInput.decode(JSON.parse(`"${jsonStr}"`), decodingOptions)
      } catch {}
      return result.fail(error instanceof Error ? error.message : error)
    }
  }
}
