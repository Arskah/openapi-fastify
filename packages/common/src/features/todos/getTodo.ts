import type { Todo } from '../../domain/todo.ts';
import { NotFoundError } from '../../errors.ts';
import type { TodoRepository } from '../../repositories/todo.repository.ts';
import { useCase, type UseCaseContext } from '../use-case.ts';

export type GetTodoDeps = UseCaseContext & { todoRepository: TodoRepository };

export const getTodo = useCase('getTodo', async (ctx: GetTodoDeps, id: string): Promise<Todo> => {
  const todo = await ctx.todoRepository.get(id);
  if (!todo) throw new NotFoundError('Todo', id);
  return todo;
});
