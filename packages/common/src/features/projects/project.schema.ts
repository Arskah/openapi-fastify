import { z } from 'zod';
import { TodoIdSchema, TodoSchema } from '../todos/todo.schema.ts';

export const ProjectIdSchema = z.uuid().meta({ id: 'ProjectId', description: 'Project identifier' });

export const ProjectSchema = z
  .object({
    id: ProjectIdSchema,
    name: z.string().min(1).max(100),
    todoIds: z.array(TodoIdSchema),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: 'Project' });

export const CreateProjectInputSchema = z
  .object({
    name: ProjectSchema.shape.name,
  })
  .meta({ id: 'CreateProject' });

export const ProjectDetailsSchema = ProjectSchema.omit({ todoIds: true })
  .extend({ todos: z.array(TodoSchema) })
  .meta({ id: 'ProjectDetails' });

export const ProjectTodoSchema = z
  .object({
    project: ProjectSchema,
    todo: TodoSchema,
  })
  .meta({ id: 'ProjectTodo' });

export type Project = z.infer<typeof ProjectSchema>;
export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;
export type ProjectDetails = z.infer<typeof ProjectDetailsSchema>;
export type ProjectTodo = z.infer<typeof ProjectTodoSchema>;
