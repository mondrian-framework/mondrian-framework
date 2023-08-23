import { functions, logger } from '.'
import { Function, FunctionArguments, Middleware } from './function'
import * as middleware from './middleware'
import { projection, result, types } from '@mondrian-framework/model'
import opentelemetry, {
  ValueType,
  SpanKind,
  SpanStatusCode,
  Counter,
  Histogram,
  Tracer,
  Span,
} from '@opentelemetry/api'

/**
 * The Mondrian module type.
 */
export type Module<Fs extends functions.Functions = functions.Functions, ContextInput = unknown> = {
  name: string
  version: string
  functions: Fs
  functinoOptions?: { [K in keyof Fs]?: { authentication?: AuthenticationMethod | 'NONE' } }
  authentication?: AuthenticationMethod
  context: (
    input: ContextInput,
    args: {
      input: unknown
      projection: projection.Projection | undefined
      operationId: string
      log: logger.Logger
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

//TODO: factorize UnionToIntersection to utils package
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never

/**
 * Intersection of all function's Contexts.
 */
type ContextType<F extends functions.Functions> = UnionToIntersection<
  {
    [K in keyof F]: F[K] extends functions.Function<any, any, infer Context> ? Context : never
  }[keyof F]
>

/**
 * TODO: understand if this is needed
 */
type AuthenticationMethod = { type: 'bearer'; format: 'jwt' }

/**
 * Checks for name collisions.
 */
function assertUniqueNames(functions: functions.Functions) {
  function gatherTypes(ts: types.Type[], explored?: Set<types.Type>): types.Type[] {
    explored = explored ?? new Set<types.Type>()
    for (const type of ts) {
      if (explored.has(type)) {
        continue
      }
      explored.add(type)
      const t = types.concretise(type)
      if (
        t.kind === types.Kind.Array ||
        t.kind === types.Kind.Nullable ||
        t.kind === types.Kind.Optional ||
        t.kind === types.Kind.Reference
      ) {
        gatherTypes([t.wrappedType], explored)
      } else if (t.kind === types.Kind.Object) {
        gatherTypes(Object.values(t.fields), explored)
      } else if (t.kind === types.Kind.Union) {
        gatherTypes(Object.values(t.variants), explored)
      }
    }
    return [...explored.values()]
  }

  const allTypes = gatherTypes(Object.values(functions).flatMap((f) => [f.input, f.output]))
  const allNames = allTypes
    .map((t) => types.concretise(t).options?.name)
    .flatMap((name) => (name != null ? [name] : []))
  for (let i = 0; i < allNames.length; i++) {
    if (allNames.indexOf(allNames[i]) !== i) {
      throw new Error(`Duplicated type name "${allNames[i]}"`)
    }
  }
}

/**
 * The module builder singleton. It's used to build any Mondrian module.
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
  const maxProjectionDepthMiddleware = module.options?.checks?.maxProjectionDepth
    ? [middleware.checkMaxProjectionDepth(module.options.checks.maxProjectionDepth)]
    : []
  const checkOutputTypeMiddleware =
    module.options?.checks?.output == null || module.options?.checks?.output !== 'ignore'
      ? [middleware.checkOutputType(module.options?.checks?.output ?? 'throw')]
      : []

  const wrappedFunctions = Object.fromEntries(
    Object.entries(module.functions).map(([functionName, functionBody]) => {
      const tracer = opentelemetry.trace.getTracer(`${module.name}:${functionName}-tracer`)
      const myMeter = opentelemetry.metrics.getMeter(`${module.name}:${functionName}-meter`)
      const histogram = myMeter.createHistogram('task.duration', { unit: 'milliseconds', valueType: ValueType.INT })
      const counter = myMeter.createCounter('task.invocation')
      const func: Function = {
        ...functionBody,
        middlewares: [
          ...maxProjectionDepthMiddleware,
          ...checkOutputTypeMiddleware,
          ...(functionBody.middlewares ?? []),
        ],
      }
      const wrappedFunction: Function<types.Type, types.Type, {}> = module.options?.opentelemetryInstrumentation
        ? new OpenTelemetryFunction(func, functionName, module, { histogram, tracer, counter })
        : new FunctionImplementation(func)
      return [functionName, wrappedFunction]
    }),
  ) as Fs
  return { ...module, functions: wrappedFunctions }
}

class FunctionImplementation<I extends types.Type, O extends types.Type, Context extends Record<string, unknown>>
  implements Function<I, O, Context>
{
  readonly input: I
  readonly output: O
  readonly body: (args: FunctionArguments<I, O, Context>) => Promise<types.Infer<types.PartialDeep<O>>>
  readonly middlewares: readonly Middleware<I, O, Context>[]
  readonly options: { readonly namespace?: string | undefined; readonly description?: string | undefined } | undefined

  constructor(func: Function<I, O, Context>) {
    this.input = func.input
    this.output = func.output
    this.body = func.apply
    this.middlewares = func.middlewares ?? []
    this.options = func.options
  }

  public apply(args: FunctionArguments<I, O, Context>): Promise<types.Infer<types.PartialDeep<O>>> {
    return this.execute(0, args)
  }

  private async execute(
    middlewareIndex: number,
    args: FunctionArguments<I, O, Context>,
  ): Promise<types.Infer<types.PartialDeep<O>>> {
    if (middlewareIndex >= this.middlewares.length) {
      return this.body(args)
    }
    const middleware = this.middlewares[middlewareIndex]
    return middleware.apply(args, (mappedArgs) => this.execute(middlewareIndex + 1, mappedArgs), this)
  }
}

class OpenTelemetryFunction<
  I extends types.Type,
  O extends types.Type,
  Context extends Record<string, unknown>,
> extends FunctionImplementation<I, O, Context> {
  private readonly name: string
  private readonly module: Pick<Module, 'name' | 'version'>

  private readonly tracer: Tracer
  private readonly counter: Counter
  private readonly histogram: Histogram

  public async apply(args: FunctionArguments<I, O, Context>): Promise<types.Infer<types.PartialDeep<O>>> {
    this.counter.add(1)
    const startTime = new Date().getTime()
    const spanResult = await this.tracer.startActiveSpan(
      `function:apply`,
      {
        kind: SpanKind.INTERNAL,
        //TODO: use SemanticResourceAttributes from '@opentelemetry/semantic-conventions' ?
        attributes: {
          'mondrian.function.name': this.name,
          'mondrian.module.name': this.module.name,
          'mondrian.module.version': this.module.version,
          'mondrian.operation.id': args.operationId,
          'mondrian.operation.projection': JSON.stringify(args.projection),
        },
      },
      async (span) => {
        try {
          const r = await this.executeWithinSpan(0, args, span)
          span.setStatus({ code: SpanStatusCode.OK })
          span.end()
          return result.ok<types.Infer<types.PartialDeep<O>>, unknown>(r)
        } catch (error) {
          //TODO: evaluate if needed (maybe it contains secrets)
          /*span.setAttribute(
            'mondrian.input',
            JSON.stringify(types.concretise(this.input).encodeWithoutValidation(args.input as never)),
          )*/
          if (error instanceof Error) {
            span.recordException(error)
          }
          span.setStatus({ code: SpanStatusCode.ERROR })
          span.end()
          return result.fail<types.Infer<types.PartialDeep<O>>, unknown>(error)
        }
      },
    )
    const finishTIme = new Date().getTime()
    this.histogram.record(finishTIme - startTime)
    if (!spanResult.isOk) {
      throw spanResult.error
    }
    return spanResult.value
  }

  private async executeWithinSpan(
    middlewareIndex: number,
    args: FunctionArguments<I, O, Context>,
    span: Span,
  ): Promise<types.Infer<types.PartialDeep<O>>> {
    if (middlewareIndex >= this.middlewares.length) {
      span.addEvent('body execution')
      return this.body(args)
    }
    const middleware = this.middlewares[middlewareIndex]
    span.addEvent('midlleware execution', { name: middleware.name })
    return middleware.apply(args, (mappedArgs) => this.executeWithinSpan(middlewareIndex + 1, mappedArgs, span), this)
  }

  constructor(
    func: Function<I, O, Context>,
    name: string,
    module: Pick<Module, 'name' | 'version'>,
    opentelemetry: {
      tracer: Tracer
      counter: Counter
      histogram: Histogram
    },
  ) {
    super(func)
    this.name = name
    this.module = module
    this.tracer = opentelemetry.tracer
    this.counter = opentelemetry.counter
    this.histogram = opentelemetry.histogram
  }
}
