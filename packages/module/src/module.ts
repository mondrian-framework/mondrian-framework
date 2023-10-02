import { functions, logger } from '.'
import { ErrorType } from './function'
import { BaseFunction } from './function/base'
import { OpentelemetryFunction } from './function/opentelemetry'
import * as middleware from './middleware'
import { allUniqueTypes } from './utils'
import { projection, types } from '@mondrian-framework/model'
import { UnionToIntersection, count, JSONType, mapObject } from '@mondrian-framework/utils'
import opentelemetry, { ValueType } from '@opentelemetry/api'

/**
 * The Mondrian module interface.
 * Contains only the function signatures, module name and version.
 */
export interface ModuleInterface<Fs extends functions.FunctionsInterfaces = functions.FunctionsInterfaces> {
  name: string
  version: string
  functions: Fs
}

/**
 * The Mondrian module type.
 * Contains all the module functions with also the implementation and how to build the context.
 */
export interface Module<Fs extends functions.Functions = functions.Functions, ContextInput = unknown>
  extends ModuleInterface {
  name: string
  version: string
  functions: Fs
  context: (
    input: ContextInput,
    args: {
      input: unknown
      projection: projection.Projection | undefined
      operationId: string
      logger: logger.MondrianLogger
    },
  ) => Promise<ContextType<Fs>>
  options?: ModuleOptions
}

/**
 * Mondrian module options.
 */
export type ModuleOptions = {
  checks?: {
    /**
     * Checks (at runtime) if the output value of any function is valid.
     * It also checks if the projection is respected.
     * Default is 'throw'.
     * With 'ignore' the check is skipped (could be usefull in production environment in order to improve performance)
     */
    output?: 'ignore' | 'log' | 'throw'
    /**
     * Maximum projection depth allowed. If the requested projection is deeper an error is thrown.
     */
    maxProjectionDepth?: number
  }
  /**
   * Enables opetelemetry instrumentation.
   */
  opentelemetryInstrumentation?: boolean
}

/**
 * Intersection of all function's Contexts.
 */
type ContextType<F extends functions.Functions> = UnionToIntersection<
  {
    [K in keyof F]: F[K] extends functions.FunctionImplementation<any, any, any, infer Context> ? Context : never
  }[keyof F]
>

/**
 * Checks for name collisions.
 */
function assertUniqueNames(functions: functions.FunctionsInterfaces) {
  const allTypes = allUniqueTypes(Object.values(functions).flatMap((f) => [f.input, f.output, f.error]))
  const allNames = [...allTypes.values()]
    .map((t) => types.concretise(t).options?.name)
    .filter((name) => name !== undefined)

  count(allNames).forEach((value, key) => {
    if (value > 1) throw new Error(`Duplicated type name "${key}"`)
  })
}

/**
 * Builds any Mondrian module.
 *
 * Example:
 * ```typescript
 * import { types } from '@mondrian-framework/model'
 * import { module } from '@mondrian-framework/module'
 *
 * const myModule = module
 *   .build({
 *     name: "MyModule",
 *     version: "0.0.1",
 *     options: { checks: { maxProjectionDepth: 5 } },
 *     functions: { login: loginFunction },
 *     context: async () => ({})
 *   })
 * ```
 */
export function build<const Fs extends functions.Functions, const ContextInput>(
  module: Module<Fs, ContextInput>,
): Module<Fs, ContextInput> {
  assertUniqueNames(module.functions)
  const maxProjectionDepthMiddleware =
    module.options?.checks?.maxProjectionDepth != null
      ? [middleware.checkMaxProjectionDepth(module.options.checks.maxProjectionDepth)]
      : []
  const checkOutputTypeMiddleware =
    module.options?.checks?.output == null || module.options?.checks?.output !== 'ignore'
      ? [middleware.checkOutputType(module.options?.checks?.output ?? 'throw')]
      : []

  const wrappedFunctions = Object.fromEntries(
    Object.entries(module.functions).map(([functionName, functionBody]) => {
      const func: functions.FunctionImplementation = {
        ...functionBody,
        middlewares: [
          ...maxProjectionDepthMiddleware,
          ...(functionBody.middlewares ?? []),
          ...checkOutputTypeMiddleware,
        ],
      }
      if (module.options?.opentelemetryInstrumentation) {
        const tracer = opentelemetry.trace.getTracer(`${module.name}:${functionName}-tracer`)
        const myMeter = opentelemetry.metrics.getMeter(`${module.name}:${functionName}-meter`)
        const histogram = myMeter.createHistogram('task.duration', { unit: 'milliseconds', valueType: ValueType.INT })
        const counter = myMeter.createCounter('task.invocation')
        const wrappedFunction: functions.FunctionImplementation<types.Type, types.Type, ErrorType, {}> =
          new OpentelemetryFunction(func, functionName, { histogram, tracer, counter })
        return [functionName, wrappedFunction]
      } else {
        return [functionName, new BaseFunction(func)]
      }
    }),
  ) as Fs
  return { ...module, functions: wrappedFunctions }
}

/**
 * Defines only the signature of the {@link Module} i.e. the {@link ModuleInterface}.
 * @param module a map of {@link FunctionInterface}, module name and module version.
 * @returns the module interface
 */
export function define<const Fs extends functions.FunctionsInterfaces>(
  module: ModuleInterface<Fs>,
): ModuleInterface<Fs> {
  assertUniqueNames(module.functions)
  return module
}

export function serialize(m: ModuleInterface): JSONType {
  const { typeMap, nameMap } = serializeTypes(m)
  const { functionMap } = serializeFunctions(m, nameMap)
  return {
    name: m.name,
    version: m.version,
    types: typeMap,
    functions: functionMap,
  }
}

function serializeTypes(m: ModuleInterface): {
  typeMap: Record<string, JSONType>
  nameMap: Map<types.Type, string>
} {
  const allTypes = Object.values(m.functions).flatMap((f) => [f.input, f.output, f.error])
  const uniqueTypes = allUniqueTypes(allTypes)
  const nameMap: Map<types.Type, string> = new Map()
  const typeMap: Record<string, JSONType> = {}
  for (const t of uniqueTypes.values()) {
    serializeType(t, nameMap, typeMap)
  }
  return { typeMap, nameMap }
}

function serializeType(
  t: types.Type,
  nameMap: Map<types.Type, string>,
  typeMap: Record<string, JSONType>,
  sourceType?: types.Type,
): string {
  const cachedName = nameMap.get(t)
  if (cachedName != null) {
    return cachedName
  }
  if (typeof t === 'function') {
    return serializeType(t(), nameMap, typeMap, t)
  }
  const name = t.options?.name ?? `__TYPE_${nameMap.size}__`
  nameMap.set(sourceType ?? t, name)

  function serializeTypeInternal(t: types.Concrete<types.Type>): JSONType {
    switch (t.kind) {
      case types.Kind.String:
        return { kind: 'string', options: t.options as JSONType }
      case types.Kind.Number:
        return { kind: 'number', options: t.options as JSONType }
      case types.Kind.Boolean:
        return { kind: 'boolean', options: t.options as JSONType }
      case types.Kind.Literal:
        return { kind: 'literal', literalValue: t.literalValue, options: t.options as JSONType }
      case types.Kind.Enum:
        return { kind: 'enum', variants: t.variants, options: t.options as JSONType }
      case types.Kind.Array:
        return {
          kind: 'array',
          wrappedType: serializeType(t.wrappedType, nameMap, typeMap),
          options: t.options as JSONType,
        }
      case types.Kind.Nullable:
        return {
          kind: 'nullable',
          wrappedType: serializeType(t.wrappedType, nameMap, typeMap),
          options: t.options as JSONType,
        }
      case types.Kind.Optional:
        return {
          kind: 'optional',
          wrappedType: serializeType(t.wrappedType, nameMap, typeMap),
          options: t.options as JSONType,
        }
      case types.Kind.Object:
        return {
          kind: 'object',
          fields: mapObject(t.fields, (_, field: types.Field) => {
            if ('virtual' in field) {
              return { virtual: serializeType(field.virtual, nameMap, typeMap) }
            } else {
              return serializeType(field, nameMap, typeMap)
            }
          }),
          options: t.options as JSONType,
        }
      case types.Kind.Union:
        return {
          kind: 'object',
          variants: mapObject(t.variants, (_, variantType: types.Type) => serializeType(variantType, nameMap, typeMap)),
          options: t.options as JSONType,
        }
      case types.Kind.Custom:
        return {
          kind: 'custom',
          typeName: t.typeName,
          options: t.options as JSONType,
        }
    }
  }

  const serializedType: JSONType = serializeTypeInternal(t)
  typeMap[name] = serializedType
  return name
}

function serializeFunctions(
  m: ModuleInterface,
  nameMap: Map<types.Type, string>,
): {
  functionMap: Record<string, JSONType>
} {
  const functionMap = mapObject(m.functions, (functionName, functionInterface) => {
    const input = nameMap.get(functionInterface.input)
    if (!input) {
      throw new Error(`Input  typefor function ${functionName} not found in name map`)
    }
    const output = nameMap.get(functionInterface.output)
    if (!output) {
      throw new Error(`Output type for function ${functionName} not found in name map`)
    }
    const error = nameMap.get(functionInterface.error)
    if (!error) {
      throw new Error(`Error type for function ${functionName} not found in name map`)
    }
    return {
      input,
      output,
      error,
      options: functionInterface.options as JSONType,
    } satisfies JSONType
  })
  return { functionMap }
}
