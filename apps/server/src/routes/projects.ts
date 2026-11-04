import {
  type Container,
  CreateProjectInputSchema,
  CreateTodoInputSchema,
  ProjectDetailsSchema,
  ProjectIdSchema,
  ProjectSchema,
  ProjectTodoSchema,
} from '@demo/common';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { ServerConfig } from '../config.ts';
import { ErrorResponseSchema } from '../errors.ts';

const IdParams = z.object({ id: ProjectIdSchema });
const tags = ['projects'];

export const projectRoutes: FastifyPluginAsyncZod<{ container: Container<ServerConfig> }> = async (
  app,
  { container },
) => {
  app.post(
    '/projects',
    {
      schema: {
        operationId: 'createProject',
        tags,
        body: CreateProjectInputSchema,
        response: { 201: ProjectSchema, 400: ErrorResponseSchema },
      },
    },
    async (request, reply) => {
      const project = await container.projectService.create(request.body);
      return reply.code(201).send(project);
    },
  );

  app.get(
    '/projects/:id',
    {
      schema: {
        operationId: 'getProject',
        tags,
        params: IdParams,
        response: { 200: ProjectDetailsSchema, 404: ErrorResponseSchema },
      },
    },
    (request) => container.projectService.get(request.params.id),
  );

  app.post(
    '/projects/:id/todos',
    {
      schema: {
        operationId: 'addProjectTodo',
        tags,
        params: IdParams,
        body: CreateTodoInputSchema,
        response: { 201: ProjectTodoSchema, 400: ErrorResponseSchema, 404: ErrorResponseSchema },
      },
    },
    async (request, reply) => {
      const result = await container.projectService.addTodo(request.params.id, request.body);
      return reply.code(201).send(result);
    },
  );
};
