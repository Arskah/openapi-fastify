import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ProjectIdSchema, TodoIdSchema } from './ids.ts';

/**
 * A valid todo. Branded: a `Todo` only comes from the functions below or from
 * parsing (stored data), never from an object literal, so every todo a
 * repository writes went through these rules.
 */
export const TodoSchema = z
  .object({
    id: TodoIdSchema,
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    done: z.boolean(),
    /** Project the todo belongs to, if any. */
    projectId: ProjectIdSchema.optional(),
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

export function newTodo(input: CreateTodoInput, now: Date, options: { projectId?: string } = {}): Todo {
  const timestamp = now.toISOString();
  return TodoSchema.parse({
    id: randomUUID(),
    title: input.title,
    description: input.description,
    done: false,
    projectId: options.projectId,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export function applyTodoUpdate(todo: Todo, input: UpdateTodoInput, now: Date): Todo {
  const changes = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
  return TodoSchema.parse({ ...todo, ...changes, updatedAt: now.toISOString() });
}
