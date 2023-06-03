import { FastifyReply, FastifyRequest } from 'fastify'

export type ServerContext = { fastify: { request: FastifyRequest; reply: FastifyReply } }
