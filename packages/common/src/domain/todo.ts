import { randomUUID } from 'node:crypto';
import { z } from 'zod';

export const TodoIdSchema = z.uuid().meta({ id: 'TodoId', description: 'Todo identifier' });

/**
 * A valid todo. Branded: a `Todo` only comes from `createTodo` or from parsing
 * (stored data, API responses), never from an object literal, so every todo a
 * repository writes went through the rules below.
 */
export const TodoSchema = z
  .object({
    id: TodoIdSchema,
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    done: z.boolean(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .brand<'Todo'>()
  .meta({ id: 'Todo' });

export const CreateTodoInputSchema = z
  .object({
    title: TodoSchema.shape.title,
    description: TodoSchema.shape.description,
  })
  .meta({ id: 'CreateTodo' });

export const UpdateTodoInputSchema = z
  .object({
    title: TodoSchema.shape.title.optional(),
    description: TodoSchema.shape.description,
    done: z.boolean().optional(),
  })
  .refine((input) => Object.values(input).some((value) => value !== undefined), {
    message: 'At least one field must be provided',
  })
  .meta({ id: 'UpdateTodo' });

export type Todo = z.infer<typeof TodoSchema>;
export type CreateTodoInput = z.infer<typeof CreateTodoInputSchema>;
export type UpdateTodoInput = z.infer<typeof UpdateTodoInputSchema>;

/** Changes to apply to a stored todo; only `todoPatch` produces one. */
export type TodoPatch = UpdateTodoInput & { updatedAt: string } & z.$brand<'TodoPatch'>;

export function createTodo(input: CreateTodoInput, now: Date): Todo {
  const timestamp = now.toISOString();
  return TodoSchema.parse({
    id: randomUUID(),
    title: input.title,
    description: input.description,
    done: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export function todoPatch(input: UpdateTodoInput, now: Date): TodoPatch {
  return { ...UpdateTodoInputSchema.parse(input), updatedAt: now.toISOString() } as TodoPatch;
}
