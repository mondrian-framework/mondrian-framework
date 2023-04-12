import * as grpc from '@grpc/grpc-js'
import * as grpcLoader from '@grpc/proto-loader'
import wrapServerWithReflection from 'grpc-node-server-reflection'
import { Types } from './type-system'
import { Module, ModuleRunnerOptions, Operations } from './mondrian'

export async function createGRPCServer<const T extends Types, const O extends Operations<T>, const Context>({
  module,
  options,
}: {
  module: Module<T, O, Context>
  options: ModuleRunnerOptions
}): Promise<void> {
  if (!options.grpc?.enabled) return

  const grpcSchema = {
    nested: {
      greeter: {
        nested: {
          HelloRequest: {
            fields: {
              name: {
                type: 'string',
                id: 1,
              },
            },
          },
          HelloResponse: {
            fields: {
              message: {
                type: 'string',
                id: 1,
              },
            },
          },
          Greeter: {
            methods: {
              SayHello: {
                requestType: 'HelloRequest',
                responseType: 'HelloResponse',
              },
            },
          },
        },
      },
    },
  } as any

  const packageDefinition = grpcLoader.fromJSON(grpcSchema, { keepCase: true })
  const grpcServer = options.grpc.reflection ? wrapServerWithReflection(new grpc.Server()) : new grpc.Server()
  const protoDescriptor = grpc.loadPackageDefinition(packageDefinition)
  const asd = protoDescriptor.greeter as any
  grpcServer.addService(asd.Greeter.service, {
    SayHello: (call: grpc.ServerUnaryCall<any, unknown>, callback: grpc.sendUnaryData<unknown>) => {
      const headers = call.metadata.getMap()
      const response = { message: `Hello ${call.request.name}!` }
      callback(null, response)
    },
  })
  grpcServer.bindAsync(`0.0.0.0:${options.grpc.port ?? 4001}`, grpc.ServerCredentials.createInsecure(), () => {
    console.log(`Server running at grpc://0.0.0.0:${options.grpc?.port ?? 4001}`)
    grpcServer.start()
  })
}
