import * as grpc from '@grpc/grpc-js'
import * as grpcLoader from '@grpc/proto-loader'
import wrapServerWithReflection from 'grpc-node-server-reflection'
import { LazyType, Types } from './type-system'
import { Module, ModuleRunnerOptions, Operations } from './mondrian'
import { HandleCall } from '@grpc/grpc-js/build/src/server-call'
import { assertNever, lazyToType } from './utils'

function mapObject<T, V>(
  o: { [s: string]: T },
  f: (key: string, value: T, i: number) => [string, V],
): { [s: string]: V } {
  return Object.fromEntries(Object.entries(o).map(([k, v], i) => f(k, v, i)))
}

function generateType(
  name: string,
  t: LazyType,
  types: Types,
  typeMap: Record<string, null | protobuf.IEnum | protobuf.IType | protobuf.IOneOf | 'processing'>,
  typeRef: Map<Function, protobuf.IField>, // function -> type name
  isOptional: boolean,
  isArray: boolean,
): protobuf.IField {
  const rule = isArray ? 'repeated' : isOptional ? 'optional' : undefined
  for (const [n, type] of Object.entries(types)) {
    if (type === t) {
      name = n
    }
  }

  if (typeMap[name] != null) {
    return { id: 0, type: name, rule }
  }

  if (typeof t === 'function') {
    const n = typeRef.get(t)
    if (n) {
      return n
    }
    typeRef.set(t, { id: 0, type: name, rule })
  }

  const type = lazyToType(t)
  if (type.kind === 'string') {
    return { id: 0, type: 'string', rule }
  }
  if (type.kind === 'custom') {
    return { id: 0, type: 'string', rule }
  }
  if (type.kind === 'number') {
    return { id: 0, type: 'double', rule }
  }
  if (type.kind === 'boolean') {
    return { id: 0, type: 'bool', rule }
  }
  if (type.kind === 'array-decorator') {
    if (isArray) {
      throw new Error('Array of array not supported')
    }
    return generateType(name, type.type, types, typeMap, typeRef, isOptional, true)
  }
  if (type.kind === 'optional-decorator') {
    return generateType(name, type.type, types, typeMap, typeRef, true, isArray)
  }
  if (type.kind === 'object') {
    typeMap[name] = 'processing'
    const fields = mapObject(type.type, (fieldName, fieldT, i) => {
      const fieldType = generateType(`${name}_${fieldName}`, fieldT, types, typeMap, typeRef, false, false)
      return [fieldName, { ...fieldType, id: i } as protobuf.IField]
    })
    typeMap[name] = { fields }
    return { id: 0, type: name, rule }
  }
  if (type.kind === 'literal') {
    typeMap[name] = { values: Object.fromEntries(type.values.map((v, i) => [v, i])) }
    return { id: 0, type: name, rule }
  }
  if (type.kind === 'union') {
    throw new Error('Union not supported') //TODO
  }

  return assertNever(type)
}

function generateTypes(
  protobufTypes: Record<string, null | protobuf.IEnum | protobuf.IType | protobuf.IOneOf>,
  types: Types,
): Record<string, protobuf.IEnum | protobuf.IType | protobuf.IOneOf> {
  const typeMap: Record<string, null | protobuf.IEnum | protobuf.IType | protobuf.IOneOf | 'processing'> = {}
  const typeRef: Map<Function, protobuf.IField> = new Map()
  for (const [name, pt] of Object.entries(protobufTypes)) {
    const asd = generateType(name, types[name], types, typeMap, typeRef, false, false)
  }
  return typeMap as Record<string, protobuf.IEnum | protobuf.IType | protobuf.IOneOf>
}

function generateProtobufSchema<const T extends Types, const O extends Operations<T>, const Context>({
  module,
  options,
}: {
  module: Module<T, O, Context>
  options: ModuleRunnerOptions
}): protobuf.INamespace {
  const usedTypes = new Set<string>()
  const query = mapObject(module.operations.queries, (queryName, query) => {
    const inputType = generateType(query.input, module.types[query.input], module.types, {}, new Map(), false, false)
    const outputType = generateType(query.output, module.types[query.output], module.types, {}, new Map(), false, false)
    const method: protobuf.IMethod = {
      comment: '',
      requestType: inputType.type,
      responseType: outputType.type,
    }
    usedTypes.add(query.input)
    usedTypes.add(query.output)
    return [queryName, method]
  })
  const mutation = mapObject(module.operations.mutations, (mutationName, mutation) => {
    const inputType = generateType(
      mutation.input,
      module.types[mutation.input],
      module.types,
      {},
      new Map(),
      false,
      false,
    )
    const outputType = generateType(
      mutation.output,
      module.types[mutation.output],
      module.types,
      {},
      new Map(),
      false,
      false,
    )
    const method: protobuf.IMethod = {
      comment: '',
      requestType: inputType.type,
      responseType: outputType.type,
    }
    usedTypes.add(mutation.input)
    usedTypes.add(mutation.output)
    return [mutationName, method]
  })
  const protoTypes = Object.fromEntries([...usedTypes.values()].map((t) => [t, null])) as Record<
    string,
    null | protobuf.IEnum | protobuf.IType | protobuf.IOneOf
  >
  const types = generateTypes(protoTypes, module.types)
  return {
    nested: {
      ...types,
      Query: {
        methods: query,
      },
      Mutation: {
        methods: mutation,
      },
    },
  }
}

function generateGrpcResolvers<const T extends Types, const O extends Operations<T>, const Context>({
  module,
  options,
}: {
  module: Module<T, O, Context>
  options: ModuleRunnerOptions
}): {
  Query: grpc.UntypedServiceImplementation
  Mutation: grpc.UntypedServiceImplementation
} {
  return {
    Query: mapObject(module.resolvers.queries, (queryName, query) => {
      const handle: HandleCall<any, any> = async (
        call: grpc.ServerUnaryCall<any, unknown>,
        callback: grpc.sendUnaryData<unknown>,
      ) => {
        const headers = mapObject(call.metadata.getMap(), (hName, h) => [
          hName,
          typeof h === 'string' ? h : h.toString(),
        ])
        module.context({ headers }).then((context) => {
          query.f({ input: call.request, context, fields: true }).then((response) => {
            callback(null, response ?? {})
          })
        })
      }
      return [queryName, handle]
    }),
    Mutation: mapObject(module.resolvers.mutations, (mutationName, mutation) => {
      const handle: HandleCall<any, any> = async (
        call: grpc.ServerUnaryCall<any, unknown>,
        callback: grpc.sendUnaryData<unknown>,
      ) => {
        const headers = mapObject(call.metadata.getMap(), (hName, h) => [
          hName,
          typeof h === 'string' ? h : h.toString(),
        ])
        module.context({ headers }).then((context) => {
          mutation.f({ input: call.request, context, fields: true }).then((response) => {
            callback(null, response ?? {})
          })
        })
      }
      return [mutationName, handle]
    }),
  }
}

export async function createGRPCServer<const T extends Types, const O extends Operations<T>, const Context>({
  module,
  options,
}: {
  module: Module<T, O, Context>
  options: ModuleRunnerOptions
}): Promise<void> {
  if (!options.grpc?.enabled) return

  const protobufSchema = generateProtobufSchema({ module, options })
  const resolvers = generateGrpcResolvers({ module, options })
  const packageDefinition = grpcLoader.fromJSON(protobufSchema, { keepCase: true })
  const grpcServer = options.grpc.reflection ? wrapServerWithReflection(new grpc.Server()) : new grpc.Server()
  const protoDescriptor = grpc.loadPackageDefinition(packageDefinition)
  grpcServer.addService((protoDescriptor as any).Query.service, resolvers.Query)
  grpcServer.addService((protoDescriptor as any).Mutation.service, resolvers.Mutation)

  grpcServer.bindAsync(`0.0.0.0:${options.grpc.port ?? 4001}`, grpc.ServerCredentials.createInsecure(), () => {
    console.log(`Server running at grpc://0.0.0.0:${options.grpc?.port ?? 4001}`)
    grpcServer.start()
  })
}
