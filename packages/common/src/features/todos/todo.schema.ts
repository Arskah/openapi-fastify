import { z } from 'zod';

export const TodoIdSchema = z.uuid().meta({ id: 'TodoId', description: 'Todo identifier' });

export const TodoSchema = z
  .object({
    id: TodoIdSchema,
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    done: z.boolean(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
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

export const TodoListSchema = z
  .object({
    items: z.array(TodoSchema),
    nextCursor: z.string().optional(),
  })
  .meta({ id: 'TodoList' });

export const ListTodosQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export type Todo = z.infer<typeof TodoSchema>;
export type CreateTodoInput = z.infer<typeof CreateTodoInputSchema>;
export type UpdateTodoInput = z.infer<typeof UpdateTodoInputSchema>;
export type TodoList = z.infer<typeof TodoListSchema>;
export type ListTodosQuery = z.infer<typeof ListTodosQuerySchema>;
