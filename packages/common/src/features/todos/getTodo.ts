import type { Container } from '../../container.ts';
import type { Todo } from '../../domain/todo.ts';
import { NotFoundError } from '../../errors.ts';
import { useCase, type UseCaseContext } from '../use-case.ts';

export type GetTodoDeps = UseCaseContext & Pick<Container, 'todoRepository'>;

export const getTodo = useCase('getTodo', async (ctx: GetTodoDeps, id: string): Promise<Todo> => {
  const todo = await ctx.todoRepository.get(id);
  if (!todo) throw new NotFoundError('Todo', id);
  return todo;
});
