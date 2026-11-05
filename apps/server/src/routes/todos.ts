import {
  type Container,
  createTodo,
  CreateTodoInputSchema,
  deleteTodo,
  getTodo,
  listTodos,
  ListTodosQuerySchema,
  TodoIdSchema,
  TodoListSchema,
  TodoSchema,
  updateTodo,
  UpdateTodoInputSchema,
} from '@demo/common';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { ServerConfig } from '../config.ts';
import { ErrorResponseSchema } from '../errors.ts';

const IdParams = z.object({ id: TodoIdSchema });
const tags = ['todos'];

export const todoRoutes: FastifyPluginAsyncZod<{ container: Container<ServerConfig> }> = async (app, { container }) => {
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
    (request) => listTodos(container, request.query),
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
      const todo = await createTodo(container, request.body);
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
    (request) => getTodo(container, request.params.id),
  );

  app.patch(
    '/todos/:id',
    {
      schema: {
        operationId: 'updateTodo',
        tags,
        params: IdParams,
        body: UpdateTodoInputSchema,
        response: { 200: TodoSchema, 400: ErrorResponseSchema, 404: ErrorResponseSchema, 409: ErrorResponseSchema },
      },
    },
    (request) => updateTodo(container, request.params.id, request.body),
  );

  app.delete(
    '/todos/:id',
    {
      schema: {
        operationId: 'deleteTodo',
        tags,
        params: IdParams,
        response: { 204: z.null().describe('Deleted'), 404: ErrorResponseSchema, 409: ErrorResponseSchema },
      },
    },
    async (request, reply) => {
      await deleteTodo(container, request.params.id);
      return reply.code(204).send(null);
    },
  );
};
