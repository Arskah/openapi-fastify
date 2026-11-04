import { z } from 'zod';
import { MAX_INITIAL_TODOS, ProjectSchema } from '../../domain/project.ts';
import { CreateTodoInputSchema, TodoSchema } from '../../domain/todo.ts';

export const CreateProjectInputSchema = z
  .object({
    name: ProjectSchema.shape.name,
    todos: z.array(CreateTodoInputSchema).max(MAX_INITIAL_TODOS).optional(),
  })
  .meta({ id: 'CreateProject' });

/** A project with its todos resolved; todos deleted since are left out. */
export const ProjectDetailsSchema = ProjectSchema.omit({ todoIds: true })
  .extend({ todos: z.array(TodoSchema) })
  .meta({ id: 'ProjectDetails' });

export const ProjectTodoSchema = z
  .object({
    project: ProjectSchema,
    todo: TodoSchema,
  })
  .meta({ id: 'ProjectTodo' });

export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;
export type ProjectDetails = z.infer<typeof ProjectDetailsSchema>;
export type ProjectTodo = z.infer<typeof ProjectTodoSchema>;
