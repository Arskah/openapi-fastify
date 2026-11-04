import { z } from 'zod';
import { TodoSchema } from '../../domain/todo.ts';

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

export type TodoList = z.infer<typeof TodoListSchema>;
export type ListTodosQuery = z.infer<typeof ListTodosQuerySchema>;
