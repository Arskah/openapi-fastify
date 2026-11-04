import {
  CreateTodoInputSchema,
  ListTodosQuerySchema,
  TodoIdSchema,
  TodoListSchema,
  TodoSchema,
  UpdateTodoInputSchema,
} from '@demo/common';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ErrorResponseSchema } from '../errors.ts';

const IdParams = z.object({ id: TodoIdSchema });
const tags = ['todos'];

export const todoRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/todos',
    {
      schema: {
        operationId: 'listTodos',
        tags,
        querystring: ListTodosQuerySchema,
        response: { 200: TodoListSchema, 400: ErrorResponseSchema },
      },
    },
    (request) => request.services.todoService.list(request.query),
  );

  app.post(
    '/todos',
    {
      schema: {
        operationId: 'createTodo',
        tags,
        body: CreateTodoInputSchema,
        response: { 201: TodoSchema, 400: ErrorResponseSchema },
      },
    },
    async (request, reply) => {
      const todo = await request.services.todoService.create(request.body);
      return reply.code(201).send(todo);
    },
  );

  app.get(
    '/todos/:id',
    {
      schema: {
        operationId: 'getTodo',
        tags,
        params: IdParams,
        response: { 200: TodoSchema, 404: ErrorResponseSchema },
      },
    },
    (request) => request.services.todoService.get(request.params.id),
  );

  app.patch(
    '/todos/:id',
    {
      schema: {
        operationId: 'updateTodo',
        tags,
        params: IdParams,
        body: UpdateTodoInputSchema,
        response: { 200: TodoSchema, 400: ErrorResponseSchema, 404: ErrorResponseSchema },
      },
    },
    (request) => request.services.todoService.update(request.params.id, request.body),
  );

  app.delete(
    '/todos/:id',
    {
      schema: {
        operationId: 'deleteTodo',
        tags,
        params: IdParams,
        response: { 204: z.null().describe('Deleted'), 404: ErrorResponseSchema },
      },
    },
    async (request, reply) => {
      await request.services.todoService.delete(request.params.id);
      return reply.code(204).send(null);
    },
  );
};
