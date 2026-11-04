import { randomUUID } from 'node:crypto';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { runWithContext, type Container } from '@demo/common';
import Fastify, { type FastifyBaseLogger, LogController } from 'fastify';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { ServerConfig } from './config.ts';
import { errorHandler } from './errors.ts';
import { transformObject } from './openapi.ts';
import { todoRoutes } from './routes/todos.ts';

const REQUEST_ID_HEADER = 'x-request-id';
const VALID_REQUEST_ID = /^[\w.:-]{1,128}$/;

export interface AppOptions {
  logger: FastifyBaseLogger;
  container: Container<ServerConfig>;
}

export async function buildApp({ logger, container }: AppOptions) {
  const app = Fastify({
    loggerInstance: logger,
    logController: new LogController({
      requestIdLogLabel: 'requestId',
      disableRequestLogging: (request) => request.url === '/health',
    }),
    // Honour an incoming request ID (from CLI, gateway, ...) when it looks sane, else mint one.
    genReqId: (req) => {
      const incoming = req.headers[REQUEST_ID_HEADER];
      return typeof incoming === 'string' && VALID_REQUEST_ID.test(incoming) ? incoming : randomUUID();
    },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler(errorHandler);

  // Continue the request inside a context so common code logs via request.log (carries requestId)
  app.addHook('onRequest', (request, reply, done) => {
    reply.header(REQUEST_ID_HEADER, request.id);
    runWithContext({ logger: request.log }, done);
  });

  await app.register(fastifySwagger, {
    openapi: {
      openapi: '3.1.0',
      info: { title: 'Todos API', version: '1.0.0' },
      servers: [{ url: `http://localhost:${container.config.server.port}` }],
    },
    transform: jsonSchemaTransform,
    transformObject,
  });
  await app.register(fastifySwaggerUi, { routePrefix: '/docs' });

  app.get('/health', { schema: { hide: true } }, () => ({ status: 'ok' }));
  await app.register(todoRoutes, { container });

  return app;
}
