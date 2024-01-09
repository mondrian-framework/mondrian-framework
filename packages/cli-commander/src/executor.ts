import { Api, build } from './api'
import { decoding, model, result } from '@mondrian-framework/model'
import { functions, module, logger } from '@mondrian-framework/module'
import { program, Command } from 'commander'

const decodingOptions: decoding.Options = {
  errorReportingStrategy: 'stopAtFirstError',
  fieldStrictness: 'allowAdditionalFields',
  typeCastingStrategy: 'tryCasting',
}

/**
 * Creates a new cli program with commander from a cli api specification.
 */
export function buildProgram<F extends functions.Functions, E extends functions.ErrorType, CI>({
  api,
  context,
}: {
  api: Api<F, E, CI>
  context: () => Promise<CI>
}): Command {
  const p = program.name(api.module.name)
  if (api.version) {
    p.version(api.version)
  }
  if (api.module.description) {
    p.description(api.module.description)
  }
  const outputHandler =
    api.output ??
    (async (result: result.Result<unknown, unknown>) => {
      if (result.isOk) {
        console.log(JSON.stringify(result.value, null, 2))
      } else {
        process.exitCode = 1
        console.error(JSON.stringify(result.error, null, 2))
      }
    })
  p.name(api.module.name)

  const baseLogger = logger.build({ moduleName: api.module.name, server: 'CRON' })
  for (const [functionName, command] of Object.entries(api.functions)) {
    if (!command) {
      continue
    }
    const functionBody = api.module.functions[functionName]

    const cmd = p.command(command === true ? functionName : command.command ?? functionName)
    const inputBindingStyle =
      (typeof command === 'object' ? command.inputBindingStyle : null) ?? api.inputBindingStyle ?? 'single-json'

    const decoder = (inputBindingStyle === 'argument-spreaded' ? argumentSpreadedBinding : singleJsonBinding)({
      cmd,
      input: functionBody.input,
      functionName,
    })

    cmd.action(async (str) => {
      const inputResult = decoder(str)
      if (inputResult.isFailure) {
        await outputHandler(inputResult, { functionName })
        return
      }
      try {
        const contextInput = await context()
        const ctxResult = await api.module.context(contextInput, {
          functionName,
          input: inputResult.value as any,
          retrieve: undefined as any,
          logger: baseLogger,
          tracer: functionBody.tracer,
        })
        if (ctxResult.isFailure) {
          await outputHandler(ctxResult, { functionName })
          return
        }
        const applyResult = await functionBody.apply({
          context: ctxResult.value,
          input: inputResult.value as any,
          retrieve: undefined as any,
          logger: baseLogger,
          tracer: functionBody.tracer,
        })
        await outputHandler(applyResult, { functionName })
      } catch (error) {
        await outputHandler(result.fail(error), { functionName })
      }
    })
  }

  return p
}

const argumentSpreadedBinding: (args: {
  cmd: Command
  input: model.Type
  functionName: string
}) => (str: any) => result.Result<unknown, unknown> = ({ cmd, input, functionName }) => {
  return model.match(input, {
    scalar: (scalar) => {
      cmd.argument(`<${scalar.options?.name ?? 'input'}>`, scalar.options?.description)
      return (str: string) => scalar.decode(str, decodingOptions)
    },
    record: (obj) => {
      for (const [fieldName, fieldType] of Object.entries(obj.fields)) {
        const concreteFieldType = model.concretise(fieldType)
        if (model.isOptional(fieldType) || model.isLiteral(fieldType, undefined)) {
          cmd.option(`--${fieldName} <value>`, `*optional* ${concreteFieldType.options?.description ?? ''}`)
        } else {
          cmd.requiredOption(`--${fieldName} <value>`, concreteFieldType.options?.description)
        }
      }
      return (args: Record<string, unknown>) => {
        return obj.decode(args, decodingOptions)
      }
    },
    otherwise: () => {
      throw new Error(
        `Impposible input binding 'argument-spreaded' on function ${functionName}.\nOnly object, entity or scalar are supported as input type.\nYou can use 'single-json' input binding in CLI api settings`,
      )
    },
  })
}

const singleJsonBinding: (args: {
  cmd: Command
  input: model.Type
  functionName: string
}) => (str: any) => result.Result<unknown, unknown> = ({ cmd, input, functionName }) => {
  const concreteInput = model.concretise(input)
  const example = concreteInput.example()
  const exampleStr = JSON.stringify(example === undefined ? null : example)

  if (model.isOptional(concreteInput) || model.isLiteral(concreteInput, undefined)) {
    cmd.argument(
      `[${concreteInput.options?.name ?? 'input'}]`,
      `${concreteInput.options?.description ?? ''} Example: '${exampleStr}'`,
    )
  } else {
    cmd.argument(
      `<${concreteInput.options?.name ?? 'input'}>`,
      `${concreteInput.options?.description ?? ''} Example: '${exampleStr}'`,
    )
  }
  return (str: string) => {
    if (str === undefined) {
      str = 'null'
    }
    try {
      return concreteInput.decode(JSON.parse(str), decodingOptions)
    } catch (error) {
      try {
        return concreteInput.decode(JSON.parse(`"${str}"`), decodingOptions)
      } catch {}
      return result.fail(error instanceof Error ? error.message : error)
    }
  }
}
