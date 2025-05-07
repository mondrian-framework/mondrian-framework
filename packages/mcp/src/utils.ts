import { ApiSpecification } from './api'
import { model, utils } from '@mondrian-framework/model'
import { functions } from '@mondrian-framework/module'
import { z, ZodRawShape, ZodTypeDef } from 'zod'

/**
 * Checks the validity of a MCP api configuration.
 * @param api the api configuration
 */
export function assertApiValidity(api: ApiSpecification<functions.FunctionInterfaces>) {
  for (const functionName in api.functions) {
    const funcSpec = api.functions[functionName]
    if (funcSpec) {
      const specs = Array.isArray(funcSpec) ? funcSpec : [funcSpec]
      for (const spec of specs) {
        if (spec.name !== undefined && spec.name.trim() === '') {
          throw new Error(`Function '${functionName}' has an invalid MCP specification: 'name' cannot be empty.`)
        }
      }
    }
  }
}

/**
 * Converts a mondrian object type to a zod shape.
 * @param type the mondrian object type
 * @returns the zod shape
 */
export function objectToZodShape(type: model.ObjectType<any, any> | (() => model.ObjectType<any, any>)): ZodRawShape {
  const concrete = model.concretise(type)
  return Object.fromEntries(
    Object.entries(concrete.fields).map(([key, value]) => {
      return [key, typeToZod(value as model.Type)]
    }),
  )
}

const typeToZod = utils.memoizeTransformation(typeToZodInternal)
function typeToZodInternal(type: model.Type): z.ZodType<any, ZodTypeDef, any> {
  return z.lazy(() =>
    model.match(type, {
      string: ({ options }) => {
        let t = z.string({ description: options?.description })
        if (options?.minLength) {
          t = t.min(options.minLength)
        }
        if (options?.maxLength) {
          t = t.max(options.maxLength)
        }
        if (options?.regex) {
          t = t.regex(options.regex)
        }
        return t
      },
      number: ({ options }) => {
        let t = z.number({ description: options?.description })
        if (options?.isInteger) {
          t = t.int()
        }
        if (options?.minimum) {
          t = t.min(options.minimum)
        }
        if (options?.maximum) {
          t = t.max(options.maximum)
        }
        return t
      },
      boolean: ({ options }) => z.boolean({ description: options?.description }),
      array: ({ options, wrappedType }) => z.array(typeToZod(wrappedType), { description: options?.description }),
      optional: ({ options, wrappedType }) => z.optional(typeToZod(wrappedType), { description: options?.description }),
      nullable: ({ options, wrappedType }) =>
        z.union([typeToZod(wrappedType), z.null()], { description: options?.description }),
      enum: ({ options, variants }) => z.enum(variants, { description: options?.description }),
      literal: ({ options, literalValue }) => z.literal(literalValue, { description: options?.description }),
      union: ({ options, variants }) =>
        z.union(
          (Object.values(variants) as model.Type[]).map(typeToZod) as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]],
          { description: options?.description },
        ),
      record: ({ options, fields }) => {
        const mappedFields = Object.fromEntries(
          Object.entries(fields).map(([key, value]) => {
            return [key, typeToZod(value as model.Type)]
          }),
        )
        return z.object(mappedFields, { description: options?.description })
      },
      otherwise: ({ options }) => z.any({ description: options?.description }),
    }),
  )
}
