import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ProjectIdSchema, TodoIdSchema } from './ids.ts';

/** A valid project. Branded like `Todo`: only the functions below or parsing produce one. */
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

export function newProject(input: { name: string }, now: Date): Project {
  const timestamp = now.toISOString();
  return ProjectSchema.parse({
    id: randomUUID(),
    name: input.name,
    todoIds: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export function withTodos(project: Project, todoIds: readonly string[], now: Date): Project {
  return ProjectSchema.parse({
    ...project,
    todoIds: [...project.todoIds, ...todoIds],
    updatedAt: now.toISOString(),
  });
}
