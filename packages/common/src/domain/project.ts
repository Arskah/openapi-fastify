import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { TodoIdSchema, type Todo } from './todo.ts';

export const ProjectIdSchema = z.uuid().meta({ id: 'ProjectId', description: 'Project identifier' });

/** A valid project. Branded like `Todo`: only `createProject` or parsing produce one. */
export const ProjectSchema = z
  .object({
    id: ProjectIdSchema,
    name: z.string().min(1).max(100),
    todoIds: z.array(TodoIdSchema),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .brand<'Project'>()
  .meta({ id: 'Project' });

export type Project = z.infer<typeof ProjectSchema>;

/**
 * Todos that can be created together with a project. Creation is one DynamoDB
 * transaction (project + todos), which holds at most 100 writes.
 */
export const MAX_INITIAL_TODOS = 50;

export function createProject(input: { name: string }, todos: readonly Todo[], now: Date): Project {
  if (todos.length > MAX_INITIAL_TODOS) {
    throw new RangeError(`A project can start with at most ${MAX_INITIAL_TODOS} todos`);
  }
  const timestamp = now.toISOString();
  return ProjectSchema.parse({
    id: randomUUID(),
    name: input.name,
    todoIds: todos.map((todo) => todo.id),
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}
